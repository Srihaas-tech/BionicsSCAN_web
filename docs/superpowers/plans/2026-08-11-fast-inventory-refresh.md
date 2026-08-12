# Fast Inventory Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Google Sheets quantity changes appear on the website within about two seconds, including after a full browser refresh.

**Architecture:** Keep Neon as the website data store and Google Sheets as the external inventory source. Client polling requests only the selected inventory type. The server page also runs the existing Sheet-to-Neon sync before its initial Neon read.

**Tech Stack:** Next.js 16.3, React, TypeScript, Google Sheets API, PostgreSQL, Neon.

## Global Constraints

- Poll every 2 seconds while the browser tab is visible.
- Sync only the selected inventory category during client polling.
- Run an immediate refresh on page load.
- Run an immediate refresh when the selected category changes.
- Run an immediate refresh when the browser tab becomes visible.
- Keep the manual Refresh now button.
- Do not start a second refresh while one is already active.
- Keep existing inventory visible if a background refresh fails.
- A browser page refresh must sync Google Sheets before initial inventory rendering.

---

## File Structure

- Modify `components/inventory-dashboard.tsx`: focused refresh requests, 2-second polling, visibility refresh, category-change refresh, and overlap protection.
- Modify `app/(app)/page.tsx`: run the existing Sheet-to-Neon sync before the initial inventory query.
- Verify `app/api/items/route.ts`: confirm that `type` drives focused Sheet synchronization and focused Neon reads.

---

### Task 1: Make dashboard refresh category-specific and non-overlapping

**Files:**
- Modify: `components/inventory-dashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/items?type=<InventoryType>`
- Produces: immediate and periodic focused refreshes for the selected category.

- [ ] **Step 1: Add overlap protection**

Add a `useRef(false)` flag such as `refreshInFlightRef`.

Before each fetch, return when the flag is already true.

Set the flag before the fetch.

Clear the flag in `finally`.

- [ ] **Step 2: Make `refreshItems` accept an inventory type**

Change the refresh function signature to accept the target `InventoryType`.

Build the request as:

```ts
fetch(`/api/items?type=${encodeURIComponent(type)}`, {
  cache: "no-store",
})
```

The response contains only that category.

Merge those returned rows into the existing `items` state instead of replacing all categories.

- [ ] **Step 3: Run an immediate refresh on mount**

When `databaseError` is false, call `refreshItems(selectedType, true)` immediately.

Do not wait for the polling interval.

- [ ] **Step 4: Poll every 2 seconds**

Use:

```ts
window.setInterval(..., 2_000)
```

Only call refresh while:

```ts
document.visibilityState === "visible"
```

- [ ] **Step 5: Refresh immediately when the selected category changes**

When `selectedType` changes, call `refreshItems(selectedType, true)`.

Avoid duplicate initial calls if the mount effect and category effect overlap.

- [ ] **Step 6: Refresh when the tab becomes visible**

Register a `visibilitychange` listener.

When the state becomes `visible`, call `refreshItems(selectedType, true)`.

Remove the listener during cleanup.

- [ ] **Step 7: Keep the manual button**

Change the existing button to call:

```ts
refreshItems(selectedType)
```

The non-quiet call must keep the existing visible syncing state.

- [ ] **Step 8: Verify types and behavior**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add components/inventory-dashboard.tsx
git commit -m "perf: poll selected inventory category"
```

---

### Task 2: Sync Google Sheets before the initial server-rendered inventory load

**Files:**
- Modify: `app/(app)/page.tsx`

**Interfaces:**
- Consumes: `syncSheetToDatabase()`
- Consumes: `listInventoryItems()`
- Produces: initial inventory that reflects the latest Sheet state after a browser refresh.

- [ ] **Step 1: Import the synchronization function**

Add:

```ts
import { syncSheetToDatabase } from "@/src/lib/inventory-sync";
```

- [ ] **Step 2: Sync before the initial Neon read**

Inside the existing `try` block, call:

```ts
try {
  await syncSheetToDatabase();
} catch (error) {
  console.error("Initial spreadsheet sync failed", error);
}
```

Then call `listInventoryItems()`.

A Google Sheets outage must not block the page when Neon is available.

- [ ] **Step 3: Verify a full browser refresh**

Change one quantity in Google Sheets.

Use the browser reload action.

Expected: the first rendered inventory reflects the changed value.

- [ ] **Step 4: Run verification**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/page.tsx
git commit -m "fix: sync Sheets before initial inventory load"
```

---

### Task 3: Verify focused API behavior and end-to-end refresh timing

**Files:**
- Verify: `app/api/items/route.ts`
- No code change unless the route does not use the validated `type` value for both sync and query.

**Interfaces:**
- Consumes: `type` query parameter.
- Produces: only the requested inventory category after focused Sheet synchronization.

- [ ] **Step 1: Verify the route calls focused sync**

Confirm that the route calls:

```ts
await syncSheetToDatabase(inventoryType);
```

- [ ] **Step 2: Verify the route returns focused inventory**

Confirm that the route calls:

```ts
await listInventoryItems(inventoryType);
```

- [ ] **Step 3: Test selected-category polling**

Open the 9mm inventory tab.

Change a 9mm quantity in Google Sheets.

Expected: the website updates within about 2 seconds.

- [ ] **Step 4: Test category switching**

Change a 15mm quantity in Google Sheets while the 9mm tab is selected.

Switch to the 15mm tab.

Expected: the 15mm category refreshes immediately.

- [ ] **Step 5: Test page reload**

Change a quantity in Google Sheets.

Reload the browser page.

Expected: the latest quantity appears without pressing Refresh now.

- [ ] **Step 6: Test tab visibility behavior**

Move to another browser tab for at least 5 seconds.

Return to the inventory tab.

Expected: the inventory refreshes immediately after visibility resumes.

- [ ] **Step 7: Check request overlap**

Inspect the Network tab or server logs during a slow Google request.

Expected: a new 2-second poll does not start while the previous refresh remains active.

- [ ] **Step 8: Run final verification**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both PASS.

- [ ] **Step 9: Commit any route change only if needed**

If `app/api/items/route.ts` required no change, do not include it in a commit.

If it required a change:

```bash
git add app/api/items/route.ts
git commit -m "perf: focus inventory sync by category"
```
