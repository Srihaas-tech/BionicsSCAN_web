import assert from "node:assert/strict";
import test from "node:test";

import {
  BionicInventoryClientError,
  listBionicInventory,
  mapBionicPart,
} from "../src/lib/bionic-inventory";

const validPart = {
  id: "c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a",
  name: "9mm Belt 1250mm",
  mfgPartNumber: "B9-1250",
  description: "",
  metadata: {
    inventoryType: "BELT_9MM",
    size: 1250,
  },
  quantity: 7,
};

test("Bionic Inventory maps backend parts into website inventory items", () => {
  assert.deepEqual(mapBionicPart(validPart), {
    id: validPart.id,
    inventoryType: "BELT_9MM",
    size: 1250,
    quantity: 7,
    barcode: "B9-1250",
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  });
});

test("Bionic Inventory rejects invalid metadata and quantities", () => {
  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      metadata: { inventoryType: "UNKNOWN", size: 1250 },
    }),
  );

  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      metadata: { inventoryType: "BELT_9MM", size: 0 },
    }),
  );

  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      quantity: 1.5,
    }),
  );
});

test("Bionic Inventory sends the producer token only in the server request header", async () => {
  const previousUrl = process.env.BIONIC_INVENTORY_API_URL;
  const previousKey = process.env.BIONIC_INVENTORY_API_KEY;
  const previousFetch = globalThis.fetch;

  process.env.BIONIC_INVENTORY_API_URL = "https://inventory.example/api/";
  process.env.BIONIC_INVENTORY_API_KEY = "test-producer-key";

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://inventory.example/api/inventory");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-api-token"), "test-producer-key");
    assert.equal(init?.cache, "no-store");

    return new Response(JSON.stringify({ inventory: [validPart] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const items = await listBionicInventory("BELT_9MM");
    assert.equal(items.length, 1);
    assert.equal(items[0].barcode, "B9-1250");
  } finally {
    globalThis.fetch = previousFetch;
    process.env.BIONIC_INVENTORY_API_URL = previousUrl;
    process.env.BIONIC_INVENTORY_API_KEY = previousKey;
  }
});

test("Bionic Inventory exposes safe backend failures", async () => {
  const previousUrl = process.env.BIONIC_INVENTORY_API_URL;
  const previousKey = process.env.BIONIC_INVENTORY_API_KEY;
  const previousFetch = globalThis.fetch;

  process.env.BIONIC_INVENTORY_API_URL = "https://inventory.example/api";
  process.env.BIONIC_INVENTORY_API_KEY = "test-producer-key";

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Invalid API token." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      () => listBionicInventory(),
      (error: unknown) => {
        assert.ok(error instanceof BionicInventoryClientError);
        assert.equal(error.status, 401);
        assert.equal(error.message, "Invalid API token.");
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
    process.env.BIONIC_INVENTORY_API_URL = previousUrl;
    process.env.BIONIC_INVENTORY_API_KEY = previousKey;
  }
});
