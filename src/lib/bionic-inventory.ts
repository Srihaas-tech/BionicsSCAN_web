import { z } from "zod";

import type {
  InventoryEvent,
  InventoryItem,
  InventoryType,
} from "../types/inventory";
import { INVENTORY_TYPES } from "../types/inventory";
import { normalizeBarcode } from "./inventory";

const PLACEHOLDER_TIMESTAMP = "1970-01-01T00:00:00.000Z";

const inventoryTypeSchema = z.enum(INVENTORY_TYPES);

const bionicPartSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  mfgPartNumber: z.string().min(1),
  description: z.string(),
  metadata: z
    .object({
      inventoryType: inventoryTypeSchema,
      size: z.number().positive(),
    })
    .passthrough(),
  quantity: z.number().int().min(0),
});

const inventoryEnvelopeSchema = z.object({
  inventory: z.array(bionicPartSchema),
});

const partEnvelopeSchema = z.object({
  part: bionicPartSchema,
});

const transactionResultSchema = z.object({
  transactionId: z.string().min(1),
  recordedAt: z.string().min(1),
  lineCount: z.number().int().positive(),
});

const transactionEnvelopeSchema = z.object({
  transaction: transactionResultSchema,
});

const historyEntrySchema = z.object({
  id: z.string().min(1),
  transactionId: z.string().min(1),
  partId: z.string().uuid(),
  partName: z.string().min(1),
  mfgPartNumber: z.string().min(1),
  quantityDelta: z.number().int().refine((value) => value !== 0),
  actor: z.string().min(1),
  usedIn: z.string().nullable(),
  note: z.string().nullable(),
  recordedAt: z.string().min(1),
});

const historyEnvelopeSchema = z.object({
  history: z.array(historyEntrySchema),
});

export interface CreateBionicPartInput {
  name: string;
  mfgPartNumber: string;
  description?: string;
  metadata: {
    inventoryType: InventoryType;
    size: number;
    [key: string]: unknown;
  };
}

export interface CreateBionicTransactionInput {
  actor: string;
  recordedAt?: string;
  note?: string | null;
  lines: Array<{
    partId: string;
    quantityDelta: number;
    usedIn?: string | null;
  }>;
}

export interface BionicTransactionResult {
  transactionId: string;
  recordedAt: string;
  lineCount: number;
}

export class BionicInventoryClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BionicInventoryClientError";
  }
}

function readConfiguration(): {
  baseUrl: string;
  apiKey: string;
} {
  const rawBaseUrl = process.env.BIONIC_INVENTORY_API_URL?.trim();
  const apiKey = process.env.BIONIC_INVENTORY_API_KEY?.trim();

  if (!rawBaseUrl) {
    throw new BionicInventoryClientError(
      "BIONIC_INVENTORY_API_URL is not configured.",
      500,
    );
  }

  if (!apiKey) {
    throw new BionicInventoryClientError(
      "BIONIC_INVENTORY_API_KEY is not configured.",
      500,
    );
  }

  return {
    baseUrl: rawBaseUrl.replace(/\/+$/, ""),
    apiKey,
  };
}

async function readBackendError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string" &&
      body.error.trim()
    ) {
      return body.error.trim();
    }
  } catch {
    // Use the generic status message below.
  }

  return `Bionic Inventory request failed with status ${response.status}.`;
}

async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const { baseUrl, apiKey } = readConfiguration();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("x-api-token", apiKey);

  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new BionicInventoryClientError(
      "Bionic Inventory is unavailable.",
      503,
    );
  }

  if (!response.ok) {
    throw new BionicInventoryClientError(
      await readBackendError(response),
      response.status,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BionicInventoryClientError(
      "Bionic Inventory returned invalid JSON.",
      502,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BionicInventoryClientError(
      "Bionic Inventory returned an invalid response.",
      502,
    );
  }

  return parsed.data;
}

export function mapBionicPart(part: unknown): InventoryItem {
  const parsed = bionicPartSchema.parse(part);
  return {
    id: parsed.id,
    inventoryType: parsed.metadata.inventoryType,
    size: parsed.metadata.size,
    quantity: parsed.quantity,
    barcode: normalizeBarcode(parsed.mfgPartNumber),
    createdAt: PLACEHOLDER_TIMESTAMP,
    updatedAt: PLACEHOLDER_TIMESTAMP,
  };
}

function sortInventory(items: InventoryItem[]): InventoryItem[] {
  const order = new Map<InventoryType, number>(
    INVENTORY_TYPES.map((type, index) => [type, index]),
  );

  return [...items].sort((left, right) => {
    const typeDifference =
      (order.get(left.inventoryType) ?? 99) -
      (order.get(right.inventoryType) ?? 99);
    return typeDifference || left.size - right.size;
  });
}

export async function listBionicInventory(
  type?: InventoryType,
): Promise<InventoryItem[]> {
  const response = await requestJson(
    "/inventory",
    inventoryEnvelopeSchema,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const items = response.inventory.map(mapBionicPart);
  return sortInventory(
    type ? items.filter((item) => item.inventoryType === type) : items,
  );
}

export async function getBionicInventoryItem(
  id: string,
): Promise<InventoryItem | null> {
  if (!z.string().uuid().safeParse(id).success) {
    return null;
  }

  const response = await requestJson(
    `/inventory?id=${encodeURIComponent(id)}`,
    inventoryEnvelopeSchema,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return response.inventory.length === 0
    ? null
    : mapBionicPart(response.inventory[0]);
}

export async function findBionicInventoryItemByBarcode(
  barcode: string,
): Promise<InventoryItem | null> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) {
    return null;
  }

  const response = await requestJson(
    `/inventory?mfgPartNumber=${encodeURIComponent(normalized)}`,
    inventoryEnvelopeSchema,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return response.inventory.length === 0
    ? null
    : mapBionicPart(response.inventory[0]);
}

export async function createBionicPart(
  input: CreateBionicPartInput,
): Promise<InventoryItem> {
  const response = await requestJson(
    "/parts",
    partEnvelopeSchema,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        mfgPartNumber: normalizeBarcode(input.mfgPartNumber),
        description: input.description ?? "",
        metadata: input.metadata,
      }),
    },
  );

  return mapBionicPart(response.part);
}

export async function createBionicTransaction(
  input: CreateBionicTransactionInput,
): Promise<BionicTransactionResult> {
  const response = await requestJson(
    "/transactions",
    transactionEnvelopeSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return response.transaction;
}

export async function adjustBionicInventory(
  id: string,
  delta: 1 | -1,
): Promise<InventoryItem> {
  const current = await getBionicInventoryItem(id);
  if (!current) {
    throw new BionicInventoryClientError(
      "The inventory item was not found.",
      404,
    );
  }

  if (delta === -1 && current.quantity <= 0) {
    throw new BionicInventoryClientError(
      "The inventory item is out of stock.",
      409,
    );
  }

  await createBionicTransaction({
    actor: "bionicsscan-web",
    lines: [
      {
        partId: id,
        quantityDelta: delta,
      },
    ],
  });

  const updated = await getBionicInventoryItem(id);
  if (!updated) {
    throw new BionicInventoryClientError(
      "The updated inventory item could not be loaded.",
      502,
    );
  }

  return updated;
}

export async function listBionicInventoryEvents(
  item: InventoryItem,
  limit = 12,
): Promise<InventoryEvent[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const response = await requestJson(
    `/history?partId=${encodeURIComponent(item.id)}&limit=${safeLimit}`,
    historyEnvelopeSchema,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  let runningQuantity = item.quantity;
  return response.history.map((entry) => {
    const afterQuantity = runningQuantity;
    const beforeQuantity = afterQuantity - entry.quantityDelta;
    runningQuantity = beforeQuantity;

    return {
      id: entry.id,
      itemId: entry.partId,
      action: entry.quantityDelta > 0 ? "CHECKIN" : "CHECKOUT",
      delta: entry.quantityDelta,
      beforeQuantity,
      afterQuantity,
      actor: entry.actor,
      createdAt: entry.recordedAt,
    };
  });
}

export async function pingBionicInventory(): Promise<boolean> {
  try {
    await listBionicInventory();
    return true;
  } catch {
    return false;
  }
}
