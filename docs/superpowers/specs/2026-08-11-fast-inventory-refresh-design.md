# Fast Inventory Refresh Design

## Goal
Make inventory updates appear quickly and consistently across Google Sheets, Neon, and the website.

## Current Problems
The dashboard waits before its first automatic refresh. The browser page refresh reads Neon directly without first importing Google Sheets changes. The dashboard API also syncs every inventory category when no type is supplied, which adds unnecessary Google Sheets and database work.

## Approved Behavior
The dashboard polls every 2 seconds while the browser tab is visible.

Each poll syncs only the currently selected inventory category.

The dashboard runs an immediate sync when the page opens.

The dashboard runs an immediate sync when the selected category changes.

The dashboard runs an immediate sync when the browser tab becomes visible again.

The manual Refresh now button remains available.

A browser page refresh must also import Google Sheets changes before the initial inventory data is rendered.

## Data Flow
For client refreshes, the dashboard requests `/api/items?type=<inventoryType>`.

The API imports that Google Sheets tab into Neon, then returns the Neon rows for that inventory type.

For a browser page refresh, the server page imports Google Sheets before it loads the initial Neon inventory.

## Performance
Do not sync all four tabs during each 2-second poll.

Only the selected category is polled.

Do not start a second request when the previous refresh request is still active.

Pause polling when `document.visibilityState` is not `visible`.

## Error Handling
If Google Sheets fails, keep the existing Neon inventory visible.

If the API request fails, keep the last successful client state and show the existing offline warning.

A failed background poll must not redirect or clear inventory unless the API returns 401.

## Files
Modify `components/inventory-dashboard.tsx` for category-specific immediate and 2-second refresh behavior.

Modify `app/(app)/page.tsx` so a browser refresh imports Google Sheets before initial inventory rendering.

Keep `app/api/items/route.ts` category-aware and use the existing `type` parameter for focused synchronization.

## Verification
Confirm that a Google Sheets quantity edit appears on the visible category within about 2 seconds.

Confirm that a browser refresh shows the latest Google Sheets quantity.

Confirm that switching categories triggers an immediate category sync.

Confirm that hidden tabs stop polling and visible tabs resume immediately.

Confirm that overlapping 2-second requests do not accumulate.
