import { config } from "dotenv";
import { Pool } from "pg";
import { INITIAL_INVENTORY } from "../src/data/seed";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1, allowExitOnIdle: true });

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of INITIAL_INVENTORY) {
      await client.query(
        `INSERT INTO inventory_items (inventory_type, size, quantity, barcode)
         VALUES ($1::inventory_type, $2, $3, $4)
         ON CONFLICT (inventory_type, size)
         DO UPDATE SET barcode = EXCLUDED.barcode`,
        [item.inventoryType, item.size, item.quantity, item.barcode],
      );
    }
    await client.query("COMMIT");
    console.log(`Seeded ${INITIAL_INVENTORY.length} inventory items.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
