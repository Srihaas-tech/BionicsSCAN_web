# Two-way Google Sheets Sync Design

## Goal
Keep Neon PostgreSQL and the existing Google Sheets inventory synchronized in both directions.

## Conflict rule
The latest valid change wins. Each inventory row uses an `Updated At` timestamp. A newer timestamp replaces an older value on the other store.

## Spreadsheet layout
Each inventory tab uses:

- Column A: Size
- Column B: Quantity
- Column C: Barcode
- Column D: Updated At

The existing barcode remains the stable item key.

## Architecture
Neon remains the website database. Google Sheets remains the Android app integration surface.

Website quantity changes first commit to Neon. The backend then writes the resulting quantity and timestamp to the matching spreadsheet row.

Before the website returns inventory data or changes a quantity, the backend reads relevant spreadsheet rows and imports rows whose `Updated At` value is newer than Neon's `updated_at` value.

The Android app must write Column D whenever it changes Column B. Without that timestamp, deterministic latest-change-wins conflict resolution is not possible.

## Google configuration
The server uses these Vercel environment variables:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SPREADSHEET_ID`

The private key remains server-only. It must never enter client bundles or Git history.

## Sheet mapping
Inventory types map to these tabs:

- `BELT_9MM` -> `Belt Inventory 9mm`
- `BELT_15MM` -> `Belt Inventory 15mm`
- `GEAR` -> `Gear Inventory`
- `SPROCKET` -> `Sprocket Inventory`

## Error handling
A failed Google Sheets write must not roll back a successful Neon inventory transaction. The server logs the synchronization failure so inventory operations remain available during a Google outage.

A malformed spreadsheet row is ignored and logged. Negative quantities are never imported.

## Initial synchronization
Blank `Updated At` cells do not overwrite Neon. The first website write supplies the timestamp. Android writes must also supply timestamps after its sync update is deployed.

## Testing
Tests cover sheet-tab mapping, timestamp comparison, malformed rows, negative quantities, website-to-sheet writes, and sheet-to-Neon imports.
