import type { InventoryType } from "@/src/types/inventory";
import { applyExternalInventoryQuantity } from "@/src/db/queries";
import { readSheetRows } from "@/src/lib/google-sheets";

export interface SyncResult {
  checked: number;
  updated: number;
  skipped: number;
  errors: number;
}

const INVENTORY_TYPES: InventoryType[] = [
  "BELT_9MM",
  "BELT_15MM",
  "GEAR",
  "SPROCKET",
];

export async function syncSheetToDatabase(
  type?: InventoryType,
): Promise<SyncResult> {
  const result: SyncResult = {
    checked: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const typesToSync = type
    ? [type]
    : INVENTORY_TYPES;

  for (const inventoryType of typesToSync) {
    let rows;

    try {
      rows = await readSheetRows(inventoryType);
    } catch (error) {
      console.error(
        `Spreadsheet read failed for ${inventoryType}`,
        error,
      );

      result.errors += 1;
      continue;
    }

    for (const row of rows) {
      result.checked += 1;

      try {
        const updated =
          await applyExternalInventoryQuantity(
            row.barcode,
            row.quantity,
          );

        if (updated) {
          result.updated += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        console.error(
          `Spreadsheet sync failed for ${row.barcode}`,
          error,
        );

        result.errors += 1;
      }
    }
  }

  return result;
}