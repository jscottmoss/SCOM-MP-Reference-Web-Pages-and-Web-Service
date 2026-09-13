# Reset The Local Test Database

This project stores local preview data under the ignored `.wrangler` folder.
That folder contains:

- D1 database state for imported management pack records
- R2 bucket state for uploaded source files
- preview/cache files used by the local Cloudflare worker runtime

## Recommended Reset

Stop the local preview first, then run:

```powershell
.\scripts\reset-local-test-data.ps1 -Apply
```

That moves the local D1 database state to `.wrangler\reset-backups` and leaves
the uploaded source files alone. The next preview start creates a fresh local
database.

To reset both the database and uploaded source files, run:

```powershell
.\scripts\reset-local-test-data.ps1 -Apply -IncludeUploadedFiles
```

The script is safe by default. If you run it without `-Apply`, it only explains
what it would do:

```powershell
.\scripts\reset-local-test-data.ps1
```

## SQL Reset Alternative

The SQL file is here:

```text
sql\ScomMpReference_ResetLocalDatabase.sql
```

It drops the application tables used for original source-file metadata,
imported management packs, references, elements, category membership, and import
jobs. The app recreates those tables automatically the next time imports or
queries run.

Use the SQL file when you are connected directly to a SQLite/D1 database and
want to clear the app tables without moving the whole local state folder.

## Brand-New Local State

For the cleanest handoff to another tester, do not include `.wrangler` in the
files you give them or push to GitHub. It is ignored by `.gitignore` and should
stay local to each tester.

When another tester starts the preview for the first time, their `.wrangler`
folder and local database will be created fresh.
