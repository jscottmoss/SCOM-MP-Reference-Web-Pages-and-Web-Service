# SCOM MP Reference Web Pages and Web Service

This project is a local web catalog and web service for importing, browsing, and
querying System Center Operations Manager management packs.

## Prerequisites

- Windows PowerShell
- Node.js `>=22.13.0`
- Project dependencies installed with `npm install` or `pnpm install`

When the project is started from Codex, the startup script can also use the
bundled Codex Node runtime if Node.js is not on the normal Windows path.

## Start The Local Preview

The project now has startup automation:

```powershell
.\scripts\start-local-preview.ps1
```

That starts the catalog at:

```text
http://localhost:3000/
```

Useful options:

```powershell
.\scripts\start-local-preview.ps1 -Port 3001
.\scripts\start-local-preview.ps1 -OpenBrowser
.\scripts\start-local-preview.ps1 -LocalNetwork
```

`-LocalNetwork` binds the preview to `0.0.0.0` so another computer on the same
network can browse to this machine's IPv4 address and the chosen port. Windows
Firewall may still need to allow inbound access.

The same automation is also available through package scripts:

```powershell
npm run dev:local
npm run dev:network
```

The script writes startup output to `.local-preview.log` and startup errors to
`.local-preview.err.log`.

## Manual Commands

The plain project commands still work:

```powershell
npm run dev
npm run build
npm test
```

If the normal command has trouble finding `node` on Windows, use
`.\scripts\start-local-preview.ps1` because it handles the full runtime path.

## Important Project Pieces

- Main catalog page: `/`
- Admin page and import screen: `/admin`
- Management pack detail page: `/management-pack-selection`
- Single element detail page: `/management-pack-element`
- SQL Server category page: `/sql-server`
- User-created category pages: `/categories/{category-slug}`
- Import endpoints: `/api/import` and `/api/mp/import`
- Query endpoints: `/api/mp/packs`, `/api/mp/types`, `/api/mp/elements`,
  `/api/mp/element`, and `/api/wiki`

The Sites configuration lives in `.openai/hosting.json` and declares:

- `DB`: the D1 database binding used for imported management pack data
- `MP_FILES`: the R2 bucket binding used for uploaded source files

`vite.config.ts` wires those bindings into the local preview. The database
tables are created automatically by the web service when imports or queries run.

## Web Service File Storage

The project keeps two related records for uploaded files:

- The exact original file bytes are stored unchanged in the `MP_FILES` R2
  bucket.
- Parsed management pack data is stored in D1 so the pages can show references,
  elements, raw XML fragments, categories, and downloads.

The source-file metadata lives in the `mp_source_files` table. It records the
source file ID, original filename, extension, content type, byte size, SHA-256
hash, R2 storage key, processing status/message, and how many management packs
were extracted from the upload.

This is important for MPB/MBP bundles: one uploaded source file can produce
several parsed management pack rows, but all of those rows point back to the
same original file for byte-for-byte download.

Useful storage endpoints:

```text
POST /api/files
GET  /api/files/download?sourceFileId={sourceFileId}
GET  /api/mp/download?managementPackId={managementPackId}&format=xml
GET  /api/mp/download?managementPackId={managementPackId}&format=source
```

## How The Web Pages Work

The web pages are driven by imported management pack records in the local
database. Each imported file is stored as its own management pack version, so
multiple versions of the same management pack name can exist side by side.

### Catalog Home Page

`/` is the main landing page. It only shows imported management packs, recent
imports, and category pages. The management pack name links to the selected
management pack version on `/management-pack-selection`.

### Management Pack Selection Page

`/management-pack-selection?managementPack={name}&version={version}` shows one
specific imported management pack version. This page includes:

- the selected management pack summary
- a version drop-down scoped to other imported versions with the same
  management pack name
- an optional References section controlled by the References checkbox
- Management Pack Elements scoped to only the selected management pack version
- separate element tables for Classes, Relationships, Discoveries, Rules,
  Monitors, Module Types, Overrides, Resources, and other stored element types

In element tables, the `DisplayName` column links to the single element page. If
a table does not show `DisplayName`, the `ID` column is used as the link.

### Single Element Detail Page

`/management-pack-element?managementPack={name}&version={version}&id={elementId}&type={elementType}`
shows one exact element from one exact management pack version. It uses
`/api/mp/element` to load the stored element record and displays:

- the element display name
- the element ID and element type
- element properties such as Context, Target, RunAs, Accessibility, Enabled,
  Property, Value, and Enforced when those fields exist
- detail tables such as Member Modules, Overrideable Parameters, Monitor Type
  States, Regular Detections, and similar parsed sections
- the stored source XML for that element

This is the page used for viewing items such as
`DiscoveryPropertyOverride`, `UnitMonitorType`, `DataSourceModuleType`, `Rule`,
`ClassType`, and other management pack elements in more detail.

### Administration Page

`/admin` is where management pack XML files are imported and categories are
managed. The web service also has backend support for stored source files and
compiled management pack sources. The same page also creates categories and lets
you choose which imported management pack versions belong to each category.

### Category Pages

`/categories/{category-slug}` shows a user-created group such as Base OS, IIS,
or SQL Server. By default it shows the highest revision of each management pack
assigned to that category. The Version View drop-down can be used to focus on a
specific imported management pack version. Category pages also show a component
breakdown for the displayed management packs.

### SQL Server Page

`/sql-server` is a family page for SQL Server management packs. SQL Server is
only one possible management pack family, so the SQL-specific list and component
breakdown are kept off the main catalog page.

### Page Data Flow

Imports are parsed by the code in `lib/` and saved through the web service. The
important stored records are:

- one management pack import row for the file, name, version, counts, and source
  metadata
- reference rows for the management pack references
- element rows for classes, relationships, discoveries, monitors, rules, module
  types, overrides, resources, display strings, and raw XML

The pages read that stored data through the `/api/mp/*` endpoints. The
management pack name, version, element ID, and element type in the page URLs are
what keep links pointed at the correct imported version.

## Import Notes

The importer accepts unsealed management pack XML files and sealed `.mp` files.
It also recognizes `.mpb`/`.mbp` bundle uploads, but Microsoft MPB bundles often
use SCOM SDK/LZX packaging. Those bundles may need to be unpacked to XML first.
CSV files can be stored through `/api/files` for original-file preservation, but
they are not parsed as management packs.

More web service detail is documented in
[`docs/MpReferenceWebService.md`](docs/MpReferenceWebService.md).

To add new Management Pack fields to page outputs, see
[`docs/AddManagementPackOutputColumn.md`](docs/AddManagementPackOutputColumn.md).

## Reset Local Test Data

To make the local preview fresh for another tester, stop the preview and run:

```powershell
.\scripts\reset-local-test-data.ps1 -Apply
```

To reset both the database and uploaded source files, run:

```powershell
.\scripts\reset-local-test-data.ps1 -Apply -IncludeUploadedFiles
```

The SQL-only reset file is
[`sql/ScomMpReference_ResetLocalDatabase.sql`](sql/ScomMpReference_ResetLocalDatabase.sql).
More detail is documented in
[`docs/ResetLocalDatabase.md`](docs/ResetLocalDatabase.md).

## Development Notes

- Site code lives under `app/` and `components/`.
- Parser and database logic lives under `lib/`.
- Static icons and images live under `public/`.
- SQL and schema reference work lives under `sql/`, `db/`, and `drizzle/`.
- Local runtime state is kept under `.wrangler/` and is ignored by git.
