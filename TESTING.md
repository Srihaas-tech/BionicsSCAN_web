# BionicsSCAN Web Test Procedure

## Automated checks

Install the packages first:

```bash
npm install
```

Run the unit tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

Run source checks:

```bash
npm run lint
```

Create the production build:

```bash
npm run build
```

Run all checks with one command:

```bash
npm run verify
```

## Database checks

Run the setup:

```bash
npm run db:setup
```

Verify the seed count:

```sql
SELECT COUNT(*) FROM inventory_items;
```

The result must equal `82`.

Verify nonnegative quantities:

```sql
SELECT * FROM inventory_items WHERE quantity < 0;
```

The query must return no rows.

## Manual inventory test

1. Start the website.
2. Sign in with `APP_PASSWORD`.
3. Open all four category tabs.
4. Verify the expected category counts.
5. Search for `B9-325`.
6. Open the 325mm 9mm belt.
7. Record the current quantity.
8. Select **Check out**.
9. Verify that the quantity decreases by one.
10. Refresh the page.
11. Verify that the quantity remains changed.
12. Select **Check in**.
13. Verify that the quantity returns to its original value.
14. Verify both actions in recent activity.

## Concurrent checkout test

Use an item with quantity `1`.

1. Open the item in two browser windows.
2. Select **Check out** in both windows.
3. Verify that one request succeeds.
4. Verify that one request reports no available items.
5. Verify that the database quantity equals `0`.

## Scanner test

Use a phone with a camera.

1. Open the deployed HTTPS URL.
2. Open **Scan**.
3. Select **Start camera**.
4. Allow camera access.
5. Scan `B9-325`.
6. Verify that the item detail page opens.
7. Enter `b15-655` manually.
8. Verify that the lookup ignores letter case.
9. Enter an unknown barcode.
10. Verify that the scanner reports no match.

## Label test

1. Open **Labels**.
2. Select each category.
3. Verify that every label shows a barcode.
4. Select **Download PDF**.
5. Open the PDF.
6. Verify that labels remain inside each border.
7. Print one test page.
8. Scan one printed label.

## Authentication test

1. Open a private browser window.
2. Open the production URL.
3. Verify that the login page opens.
4. Enter an incorrect password.
5. Verify that access remains blocked.
6. Enter the correct password.
7. Verify that the inventory page opens.
8. Select **Sign out**.
9. Verify that the login page opens again.
