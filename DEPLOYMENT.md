# Publish BionicsSCAN Web to Vercel

This procedure uses Vercel for the website and Neon for PostgreSQL.

## 1. Create a GitHub repository

Open a terminal in this project folder.

Run these commands:

```bash
git init
git add .
git commit -m "Create BionicsSCAN web application"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 2. Create the Vercel project

1. Sign in to Vercel.
2. Select **Add New Project**.
3. Import the GitHub repository.
4. Keep the detected Next.js framework.
5. Do not add a build override.
6. Select **Deploy**.

The first deployment can show a database setup error. Complete the next steps.

## 3. Add Neon Postgres

1. Open the Vercel project.
2. Open the **Storage** or **Marketplace** section.
3. Add the Neon Postgres integration.
4. Create a new Neon database.
5. Connect the database to all project environments.
6. Open the Vercel environment variable list.
7. Confirm that `DATABASE_URL` exists.

Use the pooled connection string. Keep `sslmode=require` in the value.

## 4. Add authentication variables

Open **Project Settings**, then open **Environment Variables**.

Add these variables to Production, Preview, and Development:

| Name | Value |
|---|---|
| `APP_PASSWORD` | A long shared team password |
| `SESSION_SECRET` | A random value with at least 32 characters |
| `SESSION_TTL_HOURS` | `168` |

Generate `SESSION_SECRET` locally:

```bash
openssl rand -base64 48
```

Use these PowerShell commands on Windows:

```powershell
$bytes = New-Object byte[] 48
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$generator.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$generator.Dispose()
```

Do not prefix these names with `NEXT_PUBLIC_`. The browser must not receive these values.

## 5. Create the tables and seed data

Open the Neon dashboard from the Vercel integration.

Open the Neon SQL Editor.

Copy the full contents of `database/setup.sql`.

Run the SQL file once.

Confirm these results:

- `inventory_items` contains 82 rows.
- `inventory_events` exists.
- `inventory_type` contains four enum values.

Use this verification query:

```sql
SELECT inventory_type, COUNT(*)
FROM inventory_items
GROUP BY inventory_type
ORDER BY inventory_type;
```

Expected counts:

| Inventory type | Count |
|---|---:|
| `BELT_9MM` | 32 |
| `BELT_15MM` | 29 |
| `GEAR` | 18 |
| `SPROCKET` | 3 |

## 6. Redeploy

1. Return to the Vercel project.
2. Open **Deployments**.
3. Open the latest deployment menu.
4. Select **Redeploy**.
5. Keep the current build cache option.
6. After Vercel completes the deployment, open the result page.

## 7. Verify production

1. Open the production URL.
2. Sign in with `APP_PASSWORD`.
3. Open each inventory tab.
4. Open one inventory item.
5. Check one item out.
6. Check the same item in.
7. Open the recent activity list.
8. Open the scanner on a phone.
9. Allow camera access.
10. Scan a generated label.
11. Open the labels page.
12. Download one PDF.

## 8. Add a custom domain

1. Open **Project Settings**.
2. Open **Domains**.
3. Add the domain.
4. Follow the DNS records from Vercel.
5. Open the domain after Vercel confirms the records.

## Environment variable summary

```text
DATABASE_URL=postgresql://...?...sslmode=require
APP_PASSWORD=your-long-team-password
SESSION_SECRET=your-random-secret
SESSION_TTL_HOURS=168
```

No Google Sheets service account is required.
