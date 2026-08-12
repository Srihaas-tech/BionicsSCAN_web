# Two-way Google Sheets Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Neon PostgreSQL and the existing Google Sheets inventory synchronized in both directions with latest-change-wins conflict resolution.

**Architecture:** Neon remains the website database. Google Sheets remains the Android app integration surface. Website writes commit to Neon first, then write the resulting quantity and timestamp to Sheets. Website reads import newer Sheet rows before returning inventory. Barcode is the stable cross-system key.

**Tech Stack:** Next.js 16.3, TypeScript, PostgreSQL, Drizzle, `pg`, Google Sheets API, `googleapis`, Node 22.

## Global Constraints

- Use `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_SPREADSHEET_ID` from server environment variables.
- Never expose Google credentials to browser code.
- Never commit a Google private key.
- Spreadsheet columns are A Size, B Quantity, C Barcode, D Updated At.
- Blank `Updated At` cells never overwrite Neon.
- Negative or malformed quantities never enter Neon.
- Latest valid `Updated At` wins.
- A Google Sheets outage must not roll back a successful Neon quantity update.

---

## File Structure

- Create `src/lib/google-sheets.ts`: Google authentication, tab mapping, row parsing, Sheet reads, and Sheet writes.
- Modify `src/db/queries.ts`: add an external-sync update function that accepts quantity and timestamp.
- Create `src/lib/inventory-sync.ts`: compare Sheet rows with Neon and apply newer Sheet values.
- Modify `app/api/items/route.ts`: import newer Sheet values before listing inventory.
- Modify `app/api/items/[id]/adjust/route.ts`: import newer Sheet values before mutation and push successful website mutations to Sheets.
- Modify `package.json` and `package-lock.json`: add `googleapis`.
- Create `tests/google-sheets.test.ts`: tab mapping and row parsing tests.
- Create `tests/inventory-sync.test.ts`: timestamp and conflict tests.
- Update `.env.example`: document Google environment variables.

---

### Task 1: Add Google Sheets client and row parser

**Files:**
- Create: `src/lib/google-sheets.ts`
- Create: `tests/google-sheets.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `sheetNameForType(type: InventoryType): string`
- Produces: `parseSheetRow(values: string[], inventoryType: InventoryType): SheetInventoryRow | null`
- Produces: `readSheetRows(type: InventoryType): Promise<SheetInventoryRow[]>`
- Produces: `writeItemToSheet(item: InventoryItem): Promise<void>`

- [ ] **Step 1: Install the Google API package**

Run:

```bash
npm install googleapis
```

Expected: `googleapis` appears under `dependencies`.

- [ ] **Step 2: Write failing parser and mapping tests**

Create `tests/google-sheets.test.ts` with tests for:

```ts
assert.equal(sheetNameForType("BELT_9MM"), "Belt Inventory 9mm");
assert.equal(sheetNameForType("BELT_15MM"), "Belt Inventory 15mm");
assert.equal(sheetNameForType("GEAR"), "Gear Inventory");
assert.equal(sheetNameForType("SPROCKET"), "Sprocket Inventory");
```

Also verify that a row like:

```ts
["325", "10", "B9-325", "2026-08-11T20:15:32.481Z"]
```

parses to quantity `10`, barcode `B9-325`, and a valid timestamp.

Verify that blank timestamps, negative quantities, missing barcodes, and invalid timestamps return `null`.

- [ ] **Step 3: Run the test and verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/lib/google-sheets.ts` does not exist.

- [ ] **Step 4: Implement `src/lib/google-sheets.ts`**

Define:

```ts
export interface SheetInventoryRow {
  inventoryType: InventoryType;
  size: number;
  quantity: number;
  barcode: string;
  updatedAt: Date;
  rowNumber: number;
}
```

Use this tab mapping:

```ts
const SHEET_NAMES: Record<InventoryType, string> = {
  BELT_9MM: "Belt Inventory 9mm",
  BELT_15MM: "Belt Inventory 15mm",
  GEAR: "Gear Inventory",
  SPROCKET: "Sprocket Inventory",
};
```

Create the Google client with:

```ts
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
```

Read rows from:

```ts
`${sheetName}!A2:D`
```

Write website changes by locating the barcode in Column C, then update Columns B and D for that row.

Use `USER_ENTERED` for values and `item.updatedAt` for Column D.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
```

Expected: parser and mapping tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/google-sheets.ts tests/google-sheets.test.ts
git commit -m "feat: add Google Sheets inventory client"
```

---

### Task 2: Add database import for newer Sheet values

**Files:**
- Modify: `src/db/queries.ts`
- Create: `tests/inventory-sync.test.ts`

**Interfaces:**
- Produces: `applyExternalInventoryQuantity(barcode: string, quantity: number, updatedAt: Date, actor?: string): Promise<InventoryItem | null>`

- [ ] **Step 1: Write the failing conflict tests**

Add tests that prove:

```ts
sheetUpdatedAt > neonUpdatedAt
```

means the Sheet value is eligible for import.

Also prove equal or older timestamps do not overwrite Neon.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test
```

Expected: FAIL because the external update function does not exist.

- [ ] **Step 3: Implement `applyExternalInventoryQuantity`**

Add a database function that:

1. Looks up the row by normalized barcode.
2. Rejects quantity values below zero.
3. Updates only when `$updatedAt > updated_at`.
4. Sets `quantity = $quantity` and `updated_at = $updatedAt`.
5. Creates an `inventory_events` row when quantity changed.
6. Uses actor `google-sheet` by default.

The SQL update condition must include:

```sql
AND updated_at < $3
```

Return `null` when the Sheet value is older or equal.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: conflict tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.ts tests/inventory-sync.test.ts
git commit -m "feat: import newer spreadsheet quantities"
```

---

### Task 3: Add the Sheet-to-Neon synchronization coordinator

**Files:**
- Create: `src/lib/inventory-sync.ts`
- Modify: `tests/inventory-sync.test.ts`

**Interfaces:**
- Consumes: `readSheetRows(type)`
- Consumes: `applyExternalInventoryQuantity(...)`
- Produces: `syncSheetToDatabase(type?: InventoryType): Promise<SyncResult>`

Define:

```ts
export interface SyncResult {
  checked: number;
  updated: number;
  skipped: number;
  errors: number;
}
```

- [ ] **Step 1: Write failing synchronization tests**

Test these cases:

```text
newer Sheet timestamp -> Neon update
older Sheet timestamp -> skip
blank timestamp -> parser skip
negative quantity -> parser skip
one malformed row -> other valid rows still sync
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `syncSheetToDatabase` does not exist.

- [ ] **Step 3: Implement `syncSheetToDatabase`**

For a supplied inventory type, read that tab only.

When type is omitted, process these four types in order:

```ts
["BELT_9MM", "BELT_15MM", "GEAR", "SPROCKET"]
```

Apply each valid row independently. Log row-level errors without aborting the complete sync.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: all synchronization tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory-sync.ts tests/inventory-sync.test.ts
git commit -m "feat: add Sheet to Neon synchronization"
```

---

### Task 4: Sync Google Sheets before inventory reads

**Files:**
- Modify: `app/api/items/route.ts`

**Interfaces:**
- Consumes: `syncSheetToDatabase(type?)`

- [ ] **Step 1: Add a route-level failing test or local reproduction**

Use an item whose Sheet timestamp is newer than Neon.

Call:

```text
GET /api/items?type=BELT_9MM
```

Expected before implementation: response still contains the old Neon quantity.

- [ ] **Step 2: Add pre-read synchronization**

Before `listInventoryItems(...)`, call:

```ts
await syncSheetToDatabase(inventoryType);
```

Wrap synchronization separately:

```ts
try {
  await syncSheetToDatabase(inventoryType);
} catch (error) {
  console.error("Spreadsheet import failed", error);
}
```

The route must still return Neon data when Google is unavailable.

- [ ] **Step 3: Verify**

Run:

```bash
npm run typecheck
npm test
```

Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/items/route.ts
git commit -m "feat: sync spreadsheet before inventory reads"
```

---

### Task 5: Sync both directions around website quantity changes

**Files:**
- Modify: `app/api/items/[id]/adjust/route.ts`

**Interfaces:**
- Consumes: `syncSheetToDatabase()`
- Consumes: `writeItemToSheet(item)`

- [ ] **Step 1: Reproduce the current missing write**

Check out one item on the website.

Expected before implementation: Neon changes, but Google Sheets Column B does not.

- [ ] **Step 2: Import Sheet changes before mutation**

Before `adjustInventoryQuantity(...)`, call:

```ts
try {
  await syncSheetToDatabase();
} catch (error) {
  console.error("Pre-mutation spreadsheet sync failed", error);
}
```

This prevents a website mutation from starting with a stale Neon quantity.

- [ ] **Step 3: Push the successful mutation to Sheets**

After:

```ts
const item = await adjustInventoryQuantity(id, parsed.data.delta);
```

call:

```ts
try {
  await writeItemToSheet(item);
} catch (error) {
  console.error("Spreadsheet write failed", error);
}
```

Do not return an error solely because the Sheet write failed.

- [ ] **Step 4: Verify website-to-Sheet flow**

Check out one item.

Verify:

```text
Neon quantity decreases by 1
Google Sheets Column B decreases by 1
Google Sheets Column D contains the same or equivalent ISO timestamp
```

- [ ] **Step 5: Verify Sheet-to-website flow**

Change Column B manually in Google Sheets.

Set Column D to a timestamp newer than Neon.

Refresh the website inventory.

Expected: the website displays the Sheet quantity after the request completes.

- [ ] **Step 6: Commit**

```bash
git add app/api/items/[id]/adjust/route.ts
git commit -m "feat: synchronize inventory changes with Sheets"
```

---

### Task 6: Document environment variables and verify production build

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:** None.

- [ ] **Step 1: Add environment variable names**

Add:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SPREADSHEET_ID=
```

Do not place real values in `.env.example`.

- [ ] **Step 2: Document Google Sheet permissions**

Document that the spreadsheet must be shared with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as Editor.

Document the required column order:

```text
A Size | B Quantity | C Barcode | D Updated At
```

- [ ] **Step 3: Run the full verification command**

Run:

```bash
npm run verify
```

Expected: typecheck, lint, tests, and production build all PASS.

- [ ] **Step 4: Production smoke test**

After Vercel deployment:

1. Change one quantity on the website.
2. Verify Neon and Google Sheets match.
3. Change that quantity in Google Sheets.
4. Set a newer `Updated At` value.
5. Refresh the website.
6. Verify Neon and the website match the Sheet value.
7. Test check-in and checkout again.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "docs: document Google Sheets synchronization"
```
