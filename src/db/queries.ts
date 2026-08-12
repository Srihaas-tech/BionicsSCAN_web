import { asc, desc, eq, sql } from "drizzle-orm";
import type { InventoryEvent, InventoryItem, InventoryType } from "../types/inventory";
import { normalizeBarcode } from "../lib/inventory";
import { getDatabase, getPool } from "./index";
import { inventoryEvents, inventoryItems } from "./schema";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const typeOrder = sql<number>`CASE ${inventoryItems.inventoryType}
  WHEN 'BELT_9MM' THEN 1
  WHEN 'BELT_15MM' THEN 2
  WHEN 'GEAR' THEN 3
  WHEN 'SPROCKET' THEN 4
  ELSE 5
END`;

function toItem(row: typeof inventoryItems.$inferSelect): InventoryItem {
  return {
    id: row.id,
    inventoryType: row.inventoryType,
    size: row.size,
    quantity: row.quantity,
    barcode: row.barcode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEvent(row: typeof inventoryEvents.$inferSelect): InventoryEvent {
  return {
    id: row.id,
    itemId: row.itemId,
    action: row.action as InventoryEvent["action"],
    delta: row.delta as InventoryEvent["delta"],
    beforeQuantity: row.beforeQuantity,
    afterQuantity: row.afterQuantity,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listInventoryItems(type?: InventoryType): Promise<InventoryItem[]> {
  const database = getDatabase();
  const rows = type
    ? await database
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.inventoryType, type))
        .orderBy(asc(inventoryItems.size))
    : await database
        .select()
        .from(inventoryItems)
        .orderBy(typeOrder, asc(inventoryItems.size));

  return rows.map(toItem);
}

export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const [row] = await getDatabase().select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
  return row ? toItem(row) : null;
}

export async function findInventoryItemByBarcode(barcode: string): Promise<InventoryItem | null> {
  const normalized = normalizeBarcode(barcode);
  const [row] = await getDatabase()
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.barcode, normalized))
    .limit(1);
  return row ? toItem(row) : null;
}

export async function listInventoryEvents(itemId: string, limit = 12): Promise<InventoryEvent[]> {
  if (!UUID_PATTERN.test(itemId)) {
    return [];
  }

  const rows = await getDatabase()
    .select()
    .from(inventoryEvents)
    .where(eq(inventoryEvents.itemId, itemId))
    .orderBy(desc(inventoryEvents.createdAt))
    .limit(limit);
  return rows.map(toEvent);
}

interface RawInventoryRow {
  id: string;
  inventory_type: InventoryType;
  size: number;
  quantity: number;
  barcode: string;
  created_at: Date;
  updated_at: Date;
}

function rawToItem(row: RawInventoryRow): InventoryItem {
  return {
    id: row.id,
    inventoryType: row.inventory_type,
    size: row.size,
    quantity: row.quantity,
    barcode: row.barcode,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class InventoryMutationError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "OUT_OF_STOCK",
  ) {
    super(message);
    this.name = "InventoryMutationError";
  }
}

export async function adjustInventoryQuantity(
  id: string,
  delta: 1 | -1,
  actor = "team",
): Promise<InventoryItem> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const update = await client.query<RawInventoryRow>(
      `UPDATE inventory_items
       SET quantity = quantity + $2, updated_at = NOW()
       WHERE id = $1::uuid AND quantity + $2 >= 0
       RETURNING id, inventory_type, size, quantity, barcode, created_at, updated_at`,
      [id, delta],
    );

    if (update.rowCount !== 1) {
      const existing = await client.query<{ quantity: number }>(
        "SELECT quantity FROM inventory_items WHERE id = $1::uuid",
        [id],
      );
      await client.query("ROLLBACK");
      if (existing.rowCount === 0) {
        throw new InventoryMutationError("The inventory item was not found.", "NOT_FOUND");
      }
      throw new InventoryMutationError("No items are available for checkout.", "OUT_OF_STOCK");
    }

    const item = update.rows[0];
    const beforeQuantity = item.quantity - delta;
    const action = delta === 1 ? "CHECKIN" : "CHECKOUT";

    await client.query(
      `INSERT INTO inventory_events
       (item_id, action, delta, before_quantity, after_quantity, actor)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
      [id, action, delta, beforeQuantity, item.quantity, actor.slice(0, 100)],
    );

    await client.query("COMMIT");
    return rawToItem(item);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction already closed.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function applyExternalInventoryQuantity(
  barcode: string,
  quantity: number,
  actor = "google-sheet",
): Promise<InventoryItem | null> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    return null;
  }

  const normalized = normalizeBarcode(barcode);

  if (!normalized) {
    return null;
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<RawInventoryRow>(
      `SELECT
         id,
         inventory_type,
         size,
         quantity,
         barcode,
         created_at,
         updated_at
       FROM inventory_items
       WHERE barcode = $1
       FOR UPDATE`,
      [normalized],
    );

    if (existing.rowCount !== 1) {
      await client.query("ROLLBACK");
      return null;
    }

    const current = existing.rows[0];

    if (current.quantity === quantity) {
      await client.query("ROLLBACK");
      return null;
    }

    const update = await client.query<RawInventoryRow>(
      `UPDATE inventory_items
       SET quantity = $2,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING
         id,
         inventory_type,
         size,
         quantity,
         barcode,
         created_at,
         updated_at`,
      [
        current.id,
        quantity,
      ],
    );

    if (update.rowCount !== 1) {
      await client.query("ROLLBACK");
      return null;
    }

    const delta = quantity - current.quantity;

    await client.query(
      `INSERT INTO inventory_events
       (
         item_id,
         action,
         delta,
         before_quantity,
         after_quantity,
         actor
       )
       VALUES (
         $1::uuid,
         'SYNC',
         $2,
         $3,
         $4,
         $5
       )`,
      [
        current.id,
        delta,
        current.quantity,
        quantity,
        actor.slice(0, 100),
      ],
    );

    await client.query("COMMIT");

    return rawToItem(update.rows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction already closed.
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
