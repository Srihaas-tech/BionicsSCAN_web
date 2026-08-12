# Bionic Inventory Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Neon and Google Sheets with `https://inventory-backend.team4909.org/api` as the single source of truth for the BionicsSCAN website, migrating only each item's current quantity.

**Architecture:** Add one server-only Bionic Inventory client that owns REST authentication, API response validation, and mapping into the existing `InventoryItem` model. Use a one-time migration script to read the current Neon inventory, create parts in Bionic Inventory, and create opening-balance transactions. After verification, switch all website reads and quantity mutations to the Bionic Inventory API and remove Google Sheets and Neon from the runtime data path.

**Tech Stack:** Next.js 16.3, React 19, TypeScript 5.8, Zod 4, Bionic Inventory REST API, Cloudflare D1 backend, Node.js 22+.

## Global Constraints

- `bionic-inventory` becomes the only inventory source of truth after cutover.
- Migrate current quantities only; do not migrate Neon event history or Google Sheets history.
- Preserve existing barcode values as `mfgPartNumber`.
- Preserve `BELT_9MM`, `BELT_15MM`, `GEAR`, and `SPROCKET` through `metadata.inventoryType`.
- Preserve item size through `metadata.size`.
- Keep the producer API key server-side only.
- Never expose the producer API key in browser JavaScript, HTML, logs, or client network requests.
- Keep the existing website UI, scanner, labels, login, and 2-second visible-tab refresh behavior.
- Do not fall back to Neon or Google Sheets after cutover.
- A failed Bionic Inventory mutation must not report success.
- Rotate the producer key that was exposed during setup before production deployment.

---

## File Structure

- Create `src/lib/bionic-inventory.ts`: server-side REST client, response schemas, mapping, reads, and transaction writes.
- Create `tests/bionic-inventory.test.ts`: mapping and API-client behavior tests using mocked `fetch`.
- Create `scripts/migrate-to-bionic-inventory.ts`: one-time Neon-to-Bionic current-quantity migration with verification and duplicate protection.
- Modify `package.json`: add a one-time migration command and later remove unused runtime dependencies only after cutover verification.
- Modify `app/api/items/route.ts`: read Bionic Inventory instead of Sheet-to-Neon sync.
- Modify `app/api/items/[id]/adjust/route.ts`: post Bionic Inventory transactions instead of Neon + Google Sheets writes.
- Modify `app/(app)/page.tsx`: load initial inventory from Bionic Inventory.
- Modify `app/(app)/inventory/[id]/page.tsx`: load item details from Bionic Inventory rather than Neon.
- Verify scanner and label flows; modify only if they import Neon query helpers directly.
- Remove `src/lib/google-sheets.ts` and `src/lib/inventory-sync.ts` only after production verification.
- Remove Neon runtime imports/configuration only after confirming no remaining website feature uses them.

---

### Task 1: Add the server-only Bionic Inventory client

**Files:**
- Create: `src/lib/bionic-inventory.ts`
- Create: `tests/bionic-inventory.test.ts`

**Interfaces:**
- Produces: `listBionicInventory(type?: InventoryType): Promise<InventoryItem[]>`
- Produces: `getBionicInventoryItem(id: string): Promise<InventoryItem | null>`
- Produces: `adjustBionicInventory(id: string, delta: 1 | -1): Promise<InventoryItem>`
- Produces migration helpers for creating parts and opening transactions.

- [ ] **Step 1: Write mapping tests first**

Create tests covering a backend item such as:

```ts
{
  id: "c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a",
  name: "9mm Belt 1250mm",
  mfgPartNumber: "B9-1250",
  description: "",
  metadata: { inventoryType: "BELT_9MM", size: 1250 },
  quantity: 7,
}
```

Assert it maps to the existing website shape with:

```ts
{
  id: "c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a",
  inventoryType: "BELT_9MM",
  size: 1250,
  quantity: 7,
  barcode: "B9-1250",
}
```

Use deterministic placeholder values for `createdAt` and `updatedAt` because the backend inventory response does not provide those timestamps and the current UI does not use them as authoritative inventory state.

- [ ] **Step 2: Add validation tests**

Test that invalid `metadata.inventoryType`, non-positive/non-numeric `metadata.size`, malformed UUID/id, missing `mfgPartNumber`, and non-integer quantity are rejected instead of silently entering the UI model.

- [ ] **Step 3: Run the tests and confirm failure**

Run:

```bash
npm test -- --test-name-pattern="Bionic Inventory"
```

Expected: FAIL because `src/lib/bionic-inventory.ts` does not exist yet.

- [ ] **Step 4: Implement environment access and authenticated fetch**

In `src/lib/bionic-inventory.ts`, read only server-side values:

```ts
BIONIC_INVENTORY_API_URL
BIONIC_INVENTORY_API_KEY
```

Normalize the base URL by removing a trailing slash. Send the token using `x-api-token`. Use `cache: "no-store"` for inventory reads.

Do not prefix either variable with `NEXT_PUBLIC_`.

- [ ] **Step 5: Implement Zod schemas and mapping**

Define backend schemas for inventory objects and API wrappers. Map:

```text
id -> id
mfgPartNumber -> barcode
metadata.inventoryType -> inventoryType
metadata.size -> size
quantity -> quantity
```

Use a fixed ISO string such as `1970-01-01T00:00:00.000Z` for `createdAt` and `updatedAt` unless a later backend contract adds timestamps.

- [ ] **Step 6: Implement read helpers**

Implement:

```ts
listBionicInventory(type?: InventoryType)
getBionicInventoryItem(id: string)
```

`listBionicInventory(type)` should make one `GET /inventory` request, map valid BionicsSCAN parts, and filter by type in server code.

`getBionicInventoryItem(id)` may use `GET /inventory?id=<uuid>` and return `null` for an empty result.

- [ ] **Step 7: Implement transaction helper**

Implement `adjustBionicInventory(id, delta)` using:

```json
{
  "actor": "bionicsscan-web",
  "lines": [
    {
      "partId": "<id>",
      "quantityDelta": 1
    }
  ]
}
```

After the backend returns `201`, re-read the changed part using `GET /inventory?id=<id>` and return the updated `InventoryItem`.

If the transaction API fails, throw a typed client error containing the HTTP status and safe backend error message.

- [ ] **Step 8: Implement migration-only helpers**

Add server-only helpers for:

```ts
createBionicPart(input)
createBionicTransaction(input)
```

They must use the same authenticated request layer and validate the returned part/transaction envelope.

- [ ] **Step 9: Run tests**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/bionic-inventory.ts tests/bionic-inventory.test.ts
git commit -m "feat: add bionic inventory api client"
```

---

### Task 2: Build the one-time current-quantity migration

**Files:**
- Create: `scripts/migrate-to-bionic-inventory.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes existing `listInventoryItems()` from Neon only during migration.
- Consumes Bionic migration helpers from Task 1.
- Produces one Bionic part per barcode and one opening transaction per item whose quantity is greater than zero.

- [ ] **Step 1: Add a dry-run migration command**

Add to `package.json`:

```json
"inventory:migrate:bionic": "tsx scripts/migrate-to-bionic-inventory.ts"
```

The script must require an explicit execution flag such as `--apply`; without it, it only prints the planned item count, barcode, type, size, and quantity.

- [ ] **Step 2: Load the source inventory once**

Use the existing Neon `listInventoryItems()` before Neon is removed. Sort by barcode to make logs deterministic.

- [ ] **Step 3: Refuse unsafe destination state**

Before creating anything, call Bionic `GET /inventory`.

For the first migration run, require the destination to be empty. If it is not empty, exit with a clear error and do not create additional parts.

- [ ] **Step 4: Create destination parts**

For each source item, create:

```ts
{
  name: formatItemTitle(item.inventoryType, item.size),
  mfgPartNumber: item.barcode,
  description: "",
  metadata: {
    inventoryType: item.inventoryType,
    size: item.size,
  },
}
```

Keep a map from source barcode to returned Bionic UUID.

- [ ] **Step 5: Create opening balances**

For every source item with `quantity > 0`, create an opening transaction with:

```ts
{
  actor: "bionicsscan-migration",
  note: "Initial inventory migration from BionicsSCAN",
  lines: [{ partId, quantityDelta: item.quantity }],
}
```

Do not create a zero-delta transaction for zero-quantity items.

- [ ] **Step 6: Verify exact destination state**

Re-read `GET /inventory` and compare by barcode. Fail if:

- source count differs from destination count
- any barcode is missing or duplicated
- any inventory type differs
- any size differs
- any quantity differs

Print a final summary only when every item matches.

- [ ] **Step 7: Run dry-run locally**

Run:

```bash
npm run inventory:migrate:bionic
```

Expected: no remote writes; a deterministic migration preview is printed.

- [ ] **Step 8: Rotate and configure the real producer key**

Before `--apply`, revoke the key previously exposed in chat. Store the replacement only in `.env.local` and later Vercel:

```env
BIONIC_INVENTORY_API_URL=https://inventory-backend.team4909.org/api
BIONIC_INVENTORY_API_KEY=<new producer key>
```

- [ ] **Step 9: Run the migration exactly once**

Run:

```bash
npm run inventory:migrate:bionic -- --apply
```

Expected: every current item is created and every quantity verifies exactly.

- [ ] **Step 10: Independently verify with GET /inventory**

Confirm the destination item count and representative barcodes from all four categories.

- [ ] **Step 11: Commit the migration tooling**

```bash
git add scripts/migrate-to-bionic-inventory.ts package.json package-lock.json
git commit -m "feat: add bionic inventory migration"
```

---

### Task 3: Switch website inventory reads to Bionic Inventory

**Files:**
- Modify: `app/api/items/route.ts`
- Modify: `app/(app)/page.tsx`
- Modify: `app/(app)/inventory/[id]/page.tsx`

**Interfaces:**
- Consumes `listBionicInventory()` and `getBionicInventoryItem()`.
- Produces the same browser-facing `{ items }` and existing page props used today.

- [ ] **Step 1: Update `/api/items`**

Remove imports for:

```ts
listInventoryItems
syncSheetToDatabase
```

Keep the existing session and `type` validation. Call:

```ts
const items = await listBionicInventory(inventoryType);
```

Return `{ items }` with `Cache-Control: no-store`.

Map backend/configuration failures to the existing `503` response without exposing secrets.

- [ ] **Step 2: Update the home server page**

Remove the initial Sheet sync and Neon list query. Call `listBionicInventory()` directly and pass the result into `InventoryDashboard`.

Keep the existing error fallback with `databaseError` unless renaming it would require broader unrelated UI churn.

- [ ] **Step 3: Update item detail loading**

Replace Neon item lookup in `app/(app)/inventory/[id]/page.tsx` with `getBionicInventoryItem(id)`.

Preserve existing `notFound()` behavior and rendering.

If the page also loads Neon-only event history, remove that historical panel or replace it with backend `/history?partId=<id>` in a separate focused helper; do not fabricate old history.

- [ ] **Step 4: Verify dashboard polling**

The existing 2-second browser polling should continue to call `/api/items?type=<type>`. Confirm it now performs only the Bionic backend read and no Google/Neon operation.

- [ ] **Step 5: Run verification**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/items/route.ts 'app/(app)/page.tsx' 'app/(app)/inventory/[id]/page.tsx'
git commit -m "feat: read inventory from bionic backend"
```

---

### Task 4: Switch check-in/check-out writes to Bionic Inventory

**Files:**
- Modify: `app/api/items/[id]/adjust/route.ts`

**Interfaces:**
- Consumes `adjustBionicInventory(id, delta)`.
- Produces the existing `{ item }` success response.

- [ ] **Step 1: Remove old mutation dependencies**

Remove imports for:

```ts
adjustInventoryQuantity
InventoryMutationError
writeItemToSheet
```

Import the Bionic mutation helper and typed client error.

- [ ] **Step 2: Keep existing request security**

Preserve:

- session validation
- same-origin validation
- UUID parameter validation
- Zod validation restricting `delta` to `+1` or `-1`

- [ ] **Step 3: Post the backend transaction**

Call:

```ts
const item = await adjustBionicInventory(id, parsed.data.delta);
```

Do not update Neon. Do not write Google Sheets.

- [ ] **Step 4: Return correct failures**

Map a missing backend part to `404` when appropriate. Map rejected/invalid mutations to a safe `409` or backend-derived `4xx` where the contract is clear. Map backend outage to `503` rather than reporting a successful local change.

- [ ] **Step 5: Keep revalidation**

Retain:

```ts
revalidatePath("/")
revalidatePath(`/inventory/${id}`)
```

Return the re-read backend item.

- [ ] **Step 6: Test mutation behavior**

Check in one known item and confirm backend quantity increases by exactly one.

Check out the same item and confirm it returns to the prior quantity.

Open a second browser and confirm the 2-second poll observes the change.

- [ ] **Step 7: Run verification**

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 'app/api/items/[id]/adjust/route.ts'
git commit -m "feat: write inventory transactions to bionic backend"
```

---

### Task 5: Verify scanner and labels against Bionic IDs and barcodes

**Files:**
- Verify/modify as needed: `app/(app)/scan/**`
- Verify/modify as needed: `app/(app)/labels/**`
- Verify/modify any related API routes under `app/api/**`

**Interfaces:**
- Barcode remains `mfgPartNumber` in the backend and `InventoryItem.barcode` in the web UI.
- Item links use Bionic UUIDs after migration.

- [ ] **Step 1: Trace scanner lookup**

Confirm scanner lookup ultimately searches the current `/api/items` data or Bionic helper rather than importing Neon DB queries directly.

If it uses direct Neon lookup, replace it with either:

```ts
GET /inventory?mfgPartNumber=<barcode>
```

through the server client, or filter mapped Bionic inventory server-side.

- [ ] **Step 2: Verify label generation**

Confirm labels continue encoding the unchanged barcode value such as `B9-1250`, `B15-500`, `GR-84`, or `SP-16`.

Do not encode the Bionic UUID in place of the barcode.

- [ ] **Step 3: Test representative items**

Test at least one barcode from each category:

```text
BELT_9MM
BELT_15MM
GEAR
SPROCKET
```

Expected: scan resolves to the correct Bionic part/detail page and labels remain scannable.

- [ ] **Step 4: Run verification**

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 5: Commit only changed files**

Do not include scanner or label files if no code change was required.

---

### Task 6: Production cutover and remove obsolete runtime dependencies

**Files:**
- Modify: `.env.example`
- Modify: `package.json` and `package-lock.json` only if dependencies become unused.
- Delete only after verification: `src/lib/google-sheets.ts`, `src/lib/inventory-sync.ts`
- Verify/remove Neon runtime files/imports only when no code path uses them.

**Interfaces:**
- Production website depends only on Bionic Inventory for inventory persistence.

- [ ] **Step 1: Document new environment variables**

Add to `.env.example` without real secrets:

```env
BIONIC_INVENTORY_API_URL=https://inventory-backend.team4909.org/api
BIONIC_INVENTORY_API_KEY=
```

- [ ] **Step 2: Configure Vercel**

Set the new API URL and rotated producer key in the Vercel production environment.

Never store the real key in git.

- [ ] **Step 3: Deploy before deleting fallback code**

Deploy the website with reads and writes already using Bionic Inventory.

Verify production:

- all four categories render
- quantities match migration verification
- check-in works
- check-out works
- scanner works
- labels work
- 2-second refresh works
- page reload works
- browser DevTools never shows the producer token

- [ ] **Step 4: Remove Google Sheets runtime code**

After production verification, delete:

```text
src/lib/google-sheets.ts
src/lib/inventory-sync.ts
```

Remove `googleapis` from dependencies if no other code uses it.

- [ ] **Step 5: Remove Neon runtime dependency only if unused**

Search for all imports under `src/db` and all uses of `DATABASE_URL`, `pg`, and `drizzle-orm`.

Keep migration tooling/history files if useful for archival purposes, but remove runtime imports from deployed routes/pages.

If no production code uses Neon, remove `pg` and related runtime dependencies/configuration. Do not remove `tsx` if tests or scripts still need it.

- [ ] **Step 6: Remove obsolete production secrets**

After confirming the deployed application no longer reads them, remove from Vercel:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SPREADSHEET_ID
DATABASE_URL
```

Keep unrelated authentication secrets such as `APP_PASSWORD`, `SESSION_SECRET`, and `SESSION_TTL_HOURS`.

- [ ] **Step 7: Run final verification**

Run:

```bash
npm install
npm run verify
```

Expected: PASS with no Google Sheets or Neon inventory runtime dependency.

- [ ] **Step 8: Commit cleanup**

Stage only files actually changed and commit:

```bash
git commit -m "chore: remove legacy inventory backends"
```

---

### Task 7: Prepare the Android app migration as the next phase

**Files:**
- No Android code change in this website cutover plan.

**Interfaces:**
- Shared backend identity: barcode / `mfgPartNumber`.
- Read: `GET /api/inventory`.
- Write: `POST /api/transactions`.

- [ ] **Step 1: Freeze the backend contract used by the website**

Document the exact request/response mapping proven in production so the Android client can implement the same contract without depending on Sheets.

- [ ] **Step 2: Provision a separate Android credential**

Do not reuse the website producer key in the Android APK. Decide with the backend developer how Android authentication should be handled before embedding any producer-capable secret in a distributed client.

- [ ] **Step 3: Start a separate Android migration spec**

The Android app migration should replace Google Sheets reads/writes with the Bionic Inventory API only after the website cutover is stable.

---

## Final Acceptance Test

The website cutover is complete only when all of the following are true:

- destination Bionic Inventory contains exactly one part for every existing barcode
- every migrated quantity matches the previous Neon quantity
- Neon and Google Sheets are no longer in the website inventory data path
- `/api/items` reads Bionic Inventory
- check-in/check-out writes Bionic transactions
- all four categories display correctly
- page reload shows backend data
- another browser receives changes within approximately 2 seconds
- scanner resolves barcodes correctly
- labels preserve the existing barcode format
- producer credentials never appear in browser-visible code or requests
- `npm run verify` passes
- production Vercel verification passes before obsolete secrets/dependencies are removed
