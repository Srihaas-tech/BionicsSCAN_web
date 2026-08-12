# Bionic Inventory Cutover Design

## Goal
Replace Neon and Google Sheets with `https://inventory-backend.team4909.org/api` as the single source of truth for BionicsSCAN inventory, then use the same backend for the Android app.

## Scope
This migration preserves each item's current quantity only. Existing Neon inventory-event history and Google Sheets history are not migrated.

## Source of Truth
After cutover, `bionic-inventory` is authoritative for:
- part identity
- current quantity
- future inventory transaction history

Neon and Google Sheets are removed from the website inventory data path.

## Backend Contract
The website server uses the Bionic Inventory REST API.

Read inventory:
- `GET /api/inventory`

Create catalog parts during migration:
- `POST /api/parts`

Record opening balances and future check-in/check-out changes:
- `POST /api/transactions`

The producer API key is stored server-side only. Browser code must never receive or send the producer key directly.

## Data Mapping
Each current BionicsSCAN item maps to one Bionic Inventory part:

- existing `barcode` -> `mfgPartNumber`
- existing `inventoryType` -> `metadata.inventoryType`
- existing `size` -> `metadata.size`
- display name -> a stable human-readable name based on inventory type and size

Examples:
- `B9-1250` -> 9mm belt, size 1250
- `B15-500` -> 15mm belt, size 500
- `GR-84` -> gear, 84 teeth
- `SP-16` -> sprocket, 16 teeth

The barcode remains the stable cross-client identifier.

## Quantity Migration
For every current item:
1. Create the part with `POST /api/parts`.
2. Capture the returned Bionic Inventory part UUID.
3. If the current quantity is greater than zero, create one opening transaction with that full quantity as `quantityDelta`.
4. Use actor `bionicsscan-migration` and note `Initial inventory migration from BionicsSCAN`.
5. Do not create a zero-delta transaction for zero-quantity items.

After migration, verify that every part's quantity from `GET /api/inventory` matches the source quantity exactly.

## Website Architecture
The existing Next.js UI remains in place.

A new server-side Bionic Inventory client is responsible for:
- authenticated inventory reads
- authenticated transaction writes
- mapping API inventory objects into the existing website `InventoryItem` shape

Existing website API routes remain the browser-facing boundary. They call the Bionic Inventory backend instead of Neon or Google Sheets.

The browser continues to use the website's own authenticated routes, so the backend producer key remains private.

## Website Read Flow
The website inventory route calls `GET /api/inventory` on the Bionic Inventory backend.

The response is mapped into the website model using:
- `id` from Bionic Inventory as the website item ID
- `mfgPartNumber` as barcode
- `metadata.inventoryType` as inventory type
- `metadata.size` as size
- `quantity` as current quantity

The dashboard can continue polling every 2 seconds while visible. Polling now performs one lightweight backend inventory read and no Sheet-to-Neon synchronization.

## Website Write Flow
For check-in and check-out:
1. The website receives the existing `delta` value of `+1` or `-1`.
2. The server posts one transaction line to `POST /api/transactions` using the Bionic Inventory part UUID.
3. Actor identifies the website, for example `bionicsscan-web`.
4. The route reads or returns the updated inventory state to the browser.

There is no Neon write and no Google Sheets write.

## Android App Direction
After the website cutover is stable, the Android app will use the same backend contract.

Recommended Android model:
- consumer key or an application-specific read credential for inventory reads
- producer-capable credential only where stock changes are required
- `mfgPartNumber`/barcode as the shared lookup identifier
- `POST /api/transactions` for check-in and check-out

The Android migration is a second implementation phase so the website can be validated first without changing both clients simultaneously.

## Environment
Add server-only configuration:
- `BIONIC_INVENTORY_API_URL=https://inventory-backend.team4909.org/api`
- `BIONIC_INVENTORY_API_KEY=<producer key>`

Remove after cutover and verification:
- Google Sheets service-account configuration
- Google spreadsheet ID configuration
- Neon `DATABASE_URL` if no other website feature uses Neon

The exposed producer key used during setup must be revoked and replaced before production cutover.

## Error Handling
If the Bionic Inventory backend is unavailable:
- inventory reads return the website's existing unavailable/offline response
- the dashboard keeps its last successful client state during background polling
- quantity mutations fail visibly and must not report success unless the transaction API succeeds

Do not fall back to Neon or Google Sheets after cutover. A fallback would create split-brain inventory state.

## Cutover Sequence
1. Rotate the exposed producer key and configure the replacement locally.
2. Confirm the Bionic Inventory backend is empty.
3. Export current quantities from the existing website/Neon source.
4. Run a one-time migration that creates all parts and opening balances.
5. Compare source and destination counts and quantities.
6. Switch website reads to Bionic Inventory.
7. Switch website check-in/check-out writes to Bionic Inventory transactions.
8. Verify all four categories, barcode lookup, scanner flow, labels, and 2-second refresh.
9. Deploy to Vercel with the new server-side environment variables.
10. Verify production.
11. Remove Google Sheets and Neon runtime dependencies only after production verification.
12. Migrate the Android app to the same backend in a separate phase.

## Verification Criteria
The migration is complete when:
- every existing barcode exists exactly once in Bionic Inventory
- every current quantity matches the source quantity
- 9mm belts, 15mm belts, gears, and sprockets render correctly
- website check-in increments Bionic Inventory by 1
- website check-out decrements Bionic Inventory by 1
- a second browser observes changes within the existing 2-second polling window
- page reload shows current backend inventory without Google Sheets or Neon
- scanner lookup resolves the same barcode to the correct Bionic Inventory part
- no producer API key is present in browser-delivered JavaScript or network requests

## Non-Goals
- migrating historical Neon inventory events
- preserving Google Sheets change history
- modifying the Bionic Inventory backend implementation
- migrating the Android app in the same deployment as the website cutover
