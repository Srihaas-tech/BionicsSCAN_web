# BionicsSCAN Web

BionicsSCAN Web converts the Kotlin Android application into a full-stack website.

The website preserves the four inventory categories, barcode scans, check-in, checkout, labels, and quantity control.

PostgreSQL replaces the embedded Google Sheets credential. The server keeps all database credentials outside the browser.

## Features

- Responsive inventory pages for phones, tablets, and computers
- 9mm belts, 15mm belts, gears, and sprockets
- All 82 inventory records from the Android application
- Camera barcode reader with manual entry fallback
- Atomic check-in and checkout updates
- Audit history for each inventory item
- Code 128 label previews
- A4 PDF label generation
- Shared team password protection
- Vercel and Neon support

## Technology

- Next.js 16 App Router
- React 19
- PostgreSQL
- Drizzle ORM
- ZXing browser scanner
- `bwip-js` barcode generation
- `pdf-lib` PDF generation

## Required environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection string |
| `APP_PASSWORD` | Yes | Shared team login password |
| `SESSION_SECRET` | Yes | HMAC secret for signed session cookies |
| `SESSION_TTL_HOURS` | No | Session duration. The default is 168 hours. |

Generate `SESSION_SECRET` with this command:

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

Do not commit `.env.local`. The `.gitignore` file excludes local secrets.

## Local setup with Neon

1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env.local`.
3. Add the Neon pooled connection string to `DATABASE_URL`.
4. Set `APP_PASSWORD` to a long team password.
5. Generate and set `SESSION_SECRET`.
6. Install the packages.
7. Create and seed the database.
8. Start the development server.

```bash
cp .env.example .env.local
npm install
npm run db:setup
npm run dev
```

Open `http://localhost:3000`.

## Local setup with Docker

Start PostgreSQL:

```bash
docker compose up -d
```

Use this local connection string:

```text
postgresql://bionics:bionics@localhost:5432/bionics_scan
```

Then run these commands:

```bash
npm install
npm run db:setup
npm run dev
```

## Database setup options

Use one setup method.

### Method 1: Command line

Run the migration and seed scripts:

```bash
npm run db:setup
```

The seed script preserves existing quantities on later runs.

### Method 2: Neon SQL Editor

Open the Neon SQL Editor. Run the complete `database/setup.sql` file.

The file creates both tables and inserts all 82 inventory records.

## Publish to Vercel

Read `DEPLOYMENT.md` for the complete publication process.

The required flow is:

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Add a Neon Postgres integration.
4. Confirm that Vercel created `DATABASE_URL`.
5. Add `APP_PASSWORD` and `SESSION_SECRET`.
6. Run `database/setup.sql` in the Neon SQL Editor.
7. Redeploy the Vercel project.
8. Test login, camera scans, updates, and PDF labels.

## Commands

```bash
npm run dev          # Start local development
npm run build        # Create a production build
npm run start        # Start the production build
npm run typecheck    # Check TypeScript
npm run lint         # Check source rules
npm test             # Run unit tests
npm run db:migrate   # Apply SQL migrations
npm run db:seed      # Insert seed records that do not exist
npm run db:setup     # Run migrations and seed data
npm run verify       # Run all project checks
```

## Test the website

Read `TESTING.md` for the complete test procedure.

Run all automated checks:

```bash
npm run verify
```

## Security notes

The original Android project stored a Google service account file inside the application assets.

This project does not copy that credential. It also does not expose database credentials to client code.

Use a strong `APP_PASSWORD`. Rotate the password after accidental exposure.

Use the pooled Neon connection string for `DATABASE_URL`.

## Data model

`inventory_items` stores the current quantity and barcode for each size.

`inventory_events` stores each successful check-in and checkout action.

The database rejects negative quantities. The update transaction prevents concurrent checkout conflicts.

## Original behavior changes

The Android app used Google Sheets as cloud storage. This version uses PostgreSQL as the source of truth.

The Android app synchronized every two seconds. This version refreshes visible inventory every 15 seconds.

The longer interval reduces server and database requests on a public website.
