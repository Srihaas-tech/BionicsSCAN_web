import { config } from "dotenv";

import { listInventoryItems } from "../src/db/queries";
import {
  createBionicPart,
  createBionicTransaction,
  listBionicInventory,
} from "../src/lib/bionic-inventory";
import { formatItemTitle } from "../src/lib/inventory";
import type { InventoryItem } from "../src/types/inventory";

config({ path: ".env.local" });
config();

const APPLY = process.argv.includes("--apply");

function printPreview(items: InventoryItem[]): void {
  console.log(`Migration preview: ${items.length} items`);
  for (const item of items) {
    console.log(
      `${item.barcode}\t${item.inventoryType}\t${item.size}\tqty=${item.quantity}`,
    );
  }
}

function verifyMigration(
  source: InventoryItem[],
  destination: InventoryItem[],
): void {
  if (source.length !== destination.length) {
    throw new Error(
      `Migration verification failed: source has ${source.length} items but destination has ${destination.length}.`,
    );
  }

  const destinationByBarcode = new Map<string, InventoryItem>();
  for (const item of destination) {
    if (destinationByBarcode.has(item.barcode)) {
      throw new Error(
        `Migration verification failed: duplicate destination barcode ${item.barcode}.`,
      );
    }
    destinationByBarcode.set(item.barcode, item);
  }

  for (const sourceItem of source) {
    const destinationItem = destinationByBarcode.get(sourceItem.barcode);
    if (!destinationItem) {
      throw new Error(
        `Migration verification failed: missing destination barcode ${sourceItem.barcode}.`,
      );
    }

    if (destinationItem.inventoryType !== sourceItem.inventoryType) {
      throw new Error(
        `Migration verification failed: type mismatch for ${sourceItem.barcode}.`,
      );
    }

    if (destinationItem.size !== sourceItem.size) {
      throw new Error(
        `Migration verification failed: size mismatch for ${sourceItem.barcode}.`,
      );
    }

    if (destinationItem.quantity !== sourceItem.quantity) {
      throw new Error(
        `Migration verification failed: quantity mismatch for ${sourceItem.barcode}. Source=${sourceItem.quantity}, destination=${destinationItem.quantity}.`,
      );
    }
  }
}

async function migrate(): Promise<void> {
  const source = (await listInventoryItems()).sort((left, right) =>
    left.barcode.localeCompare(right.barcode),
  );

  printPreview(source);

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write to Bionic Inventory.");
    return;
  }

  const existing = await listBionicInventory();
  if (existing.length !== 0) {
    throw new Error(
      `Destination is not empty. Found ${existing.length} items. Migration stopped without writes.`,
    );
  }

  const migratedIds = new Map<string, string>();

  for (const item of source) {
    const created = await createBionicPart({
      name: formatItemTitle(item.inventoryType, item.size),
      mfgPartNumber: item.barcode,
      description: "",
      metadata: {
        inventoryType: item.inventoryType,
        size: item.size,
      },
    });

    migratedIds.set(item.barcode, created.id);
    console.log(`Created ${item.barcode} -> ${created.id}`);
  }

  for (const item of source) {
    if (item.quantity === 0) {
      continue;
    }

    const partId = migratedIds.get(item.barcode);
    if (!partId) {
      throw new Error(`Missing migrated ID for ${item.barcode}.`);
    }

    await createBionicTransaction({
      actor: "bionicsscan-migration",
      note: "Initial inventory migration from BionicsSCAN",
      lines: [
        {
          partId,
          quantityDelta: item.quantity,
        },
      ],
    });

    console.log(`Set opening quantity ${item.barcode} = ${item.quantity}`);
  }

  const destination = await listBionicInventory();
  verifyMigration(source, destination);

  console.log(
    `Migration complete. Verified ${destination.length} items with exact current quantities.`,
  );
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
