import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_INVENTORY } from "../src/data/seed";
import {
  formatItemSize,
  getStockState,
  INVENTORY_META,
  normalizeBarcode,
} from "../src/lib/inventory";

const expectedCounts = {
  BELT_9MM: 32,
  BELT_15MM: 29,
  GEAR: 18,
  SPROCKET: 3,
};

test("the seed contains every Android inventory item", () => {
  assert.equal(INITIAL_INVENTORY.length, 82);
  for (const [type, count] of Object.entries(expectedCounts)) {
    assert.equal(INITIAL_INVENTORY.filter((item) => item.inventoryType === type).length, count);
  }
});

test("seed barcodes and category sizes are unique", () => {
  const barcodes = new Set(INITIAL_INVENTORY.map((item) => item.barcode));
  const categorySizes = new Set(
    INITIAL_INVENTORY.map((item) => `${item.inventoryType}:${item.size}`),
  );
  assert.equal(barcodes.size, INITIAL_INVENTORY.length);
  assert.equal(categorySizes.size, INITIAL_INVENTORY.length);
});

test("every seed barcode uses its category prefix", () => {
  for (const item of INITIAL_INVENTORY) {
    assert.ok(item.barcode.startsWith(`${INVENTORY_META[item.inventoryType].barcodePrefix}-`));
    assert.ok(item.quantity >= 0);
    assert.ok(item.size > 0);
  }
});

test("inventory presentation helpers preserve Android behavior", () => {
  assert.equal(formatItemSize("BELT_9MM", 325), "325mm");
  assert.equal(formatItemSize("GEAR", 48), "48T");
  assert.equal(normalizeBarcode(" b15-655 "), "B15-655");
  assert.deepEqual(getStockState(0), { label: "Out of stock", tone: "danger" });
  assert.deepEqual(getStockState(2), { label: "Low stock", tone: "warning" });
  assert.deepEqual(getStockState(3), { label: "Available", tone: "good" });
});
