import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustBionicInventory,
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

function saveEnvironment() {
  return {
    url: process.env.BIONIC_INVENTORY_API_URL,
    key: process.env.BIONIC_INVENTORY_API_KEY,
    fetch: globalThis.fetch,
  };
}

function restoreEnvironment(previous: ReturnType<typeof saveEnvironment>): void {
  globalThis.fetch = previous.fetch;

  if (previous.url === undefined) {
    delete process.env.BIONIC_INVENTORY_API_URL;
  } else {
    process.env.BIONIC_INVENTORY_API_URL = previous.url;
  }

  if (previous.key === undefined) {
    delete process.env.BIONIC_INVENTORY_API_KEY;
  } else {
    process.env.BIONIC_INVENTORY_API_KEY = previous.key;
  }
}

function configureTestEnvironment(): void {
  process.env.BIONIC_INVENTORY_API_URL =
    "https://inventory.example/api/";
  process.env.BIONIC_INVENTORY_API_KEY = "test-producer-key";
}

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

test("Bionic Inventory rejects an invalid inventory type", () => {
  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      metadata: {
        inventoryType: "UNKNOWN",
        size: 1250,
      },
    }),
  );
});

test("Bionic Inventory rejects a non-positive size", () => {
  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      metadata: {
        inventoryType: "BELT_9MM",
        size: 0,
      },
    }),
  );
});

test("Bionic Inventory rejects a non-numeric size", () => {
  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      metadata: {
        inventoryType: "BELT_9MM",
        size: "1250",
      },
    }),
  );
});

test("Bionic Inventory rejects an invalid UUID", () => {
  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      id: "not-a-uuid",
    }),
  );
});

test("Bionic Inventory rejects a missing manufacturer part number", () => {
  const part = {
    ...validPart,
  } as Partial<typeof validPart>;

  delete part.mfgPartNumber;

  assert.throws(() => mapBionicPart(part));
});

test("Bionic Inventory rejects a non-integer quantity", () => {
  assert.throws(() =>
    mapBionicPart({
      ...validPart,
      quantity: 1.5,
    }),
  );
});

test("Bionic Inventory sends the producer token in the server request header", async () => {
  const previous = saveEnvironment();
  configureTestEnvironment();

  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      "https://inventory.example/api/inventory",
    );

    const headers = new Headers(init?.headers);

    assert.equal(
      headers.get("x-api-token"),
      "test-producer-key",
    );
    assert.equal(init?.cache, "no-store");

    return new Response(
      JSON.stringify({
        inventory: [validPart],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  try {
    const items = await listBionicInventory("BELT_9MM");

    assert.equal(items.length, 1);
    assert.equal(items[0].barcode, "B9-1250");
  } finally {
    restoreEnvironment(previous);
  }
});

test("Bionic Inventory filters inventory types in server code", async () => {
  const previous = saveEnvironment();
  configureTestEnvironment();

  const gear = {
    ...validPart,
    id: "b4da3d15-2b6a-4efa-a951-65f9b3f3552f",
    name: "Gear 84T",
    mfgPartNumber: "GR-84",
    metadata: {
      inventoryType: "GEAR",
      size: 84,
    },
  };

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        inventory: [validPart, gear],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

  try {
    const items = await listBionicInventory("GEAR");

    assert.equal(items.length, 1);
    assert.equal(items[0].barcode, "GR-84");
  } finally {
    restoreEnvironment(previous);
  }
});

test("Bionic Inventory posts a transaction and reloads the changed item", async () => {
  const previous = saveEnvironment();
  configureTestEnvironment();

  let inventoryReads = 0;
  let transactionWrites = 0;

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (
      url ===
      `https://inventory.example/api/inventory?id=${validPart.id}`
    ) {
      inventoryReads += 1;

      return new Response(
        JSON.stringify({
          inventory: [
            {
              ...validPart,
              quantity: inventoryReads === 1 ? 7 : 8,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (url === "https://inventory.example/api/transactions") {
      transactionWrites += 1;

      assert.equal(init?.method, "POST");

      const requestBody = JSON.parse(String(init?.body));

      assert.deepEqual(requestBody, {
        actor: "bionicsscan-web",
        lines: [
          {
            partId: validPart.id,
            quantityDelta: 1,
          },
        ],
      });

      return new Response(
        JSON.stringify({
          transaction: {
            transactionId: "transaction-1",
            recordedAt: "2026-08-12T12:00:00.000Z",
            lineCount: 1,
          },
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const item = await adjustBionicInventory(
      validPart.id,
      1,
    );

    assert.equal(transactionWrites, 1);
    assert.equal(inventoryReads, 2);
    assert.equal(item.quantity, 8);
  } finally {
    restoreEnvironment(previous);
  }
});

test("Bionic Inventory does not report success when a transaction fails", async () => {
  const previous = saveEnvironment();
  configureTestEnvironment();

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/inventory?id=")) {
      return new Response(
        JSON.stringify({
          inventory: [validPart],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (url.endsWith("/transactions")) {
      return new Response(
        JSON.stringify({
          error: "Transaction rejected.",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    await assert.rejects(
      () => adjustBionicInventory(validPart.id, 1),
      (error: unknown) => {
  if (!(error instanceof BionicInventoryClientError)) {
    return false;
  }

  assert.equal(error.status, 409);
  assert.equal(error.message, "Transaction rejected.");

  return true;
      },
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test("Bionic Inventory exposes safe backend failures", async () => {
  const previous = saveEnvironment();
  configureTestEnvironment();

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: "Invalid API token.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

  try {
    await assert.rejects(
      () => listBionicInventory(),
      (error: unknown) => {
  if (!(error instanceof BionicInventoryClientError)) {
    return false;
  }

  assert.equal(error.status, 409);
  assert.equal(error.message, "Transaction rejected.");

  return true;
      },
    );
  } finally {
    restoreEnvironment(previous);
  }
});