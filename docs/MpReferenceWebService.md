# SCOM Management Pack Reference Web Service

This service imports unsealed SCOM management pack XML files into a versioned SQL
store and exposes JSON endpoints shaped after the older System Center Wiki /
MP catalog URL patterns.

## Import

Upload an XML, MP, or MPB file with multipart form data using the field name
`file`.

```powershell
curl.exe -X POST `
  -F "file=@C:\Users\jscottmoss\Downloads\7.6.5.0\Microsoft.SQLServer.Windows.Discovery\Microsoft.SQLServer.Windows.Discovery.xml" `
  "http://localhost:3000/api/mp/import"
```

The XML import path detects UTF-8, UTF-16 LE, and UTF-16 BE management packs.
The local upload limit is set to `32mb` so large files such as
`Microsoft.SQLServer.Windows.Monitoring.xml` can be imported.

## Original Source File Storage

The importer now follows the storage model from the Web Service File Storage
discussion:

- The original uploaded file is stored unchanged in the `MP_FILES` R2 bucket.
- A `mp_source_files` row records the source file ID, original filename,
  extension, source kind, content type, byte size, SHA-256 hash, R2 key,
  processing status, processing message, and extracted management-pack count.
- Parsed management pack rows in `mp_imports` point back to that source file
  with `source_file_id`.
- One MPB/MBP source file can therefore produce several parsed management pack
  rows while still having one exact original-file download.

Store an original file without parsing it:

```powershell
curl.exe -X POST `
  -F "file=@C:\Users\jscottmoss\Downloads\management-pack-notes.csv" `
  "http://localhost:3000/api/files"
```

Download the exact original file later:

```text
/api/files/download?sourceFileId={sourceFileId}
```

Management pack pages still use the same visible download buttons. When a
source file ID exists, the original source download uses the direct
`/api/files/download` endpoint. XML downloads still use `/api/mp/download`
because the service may need to extract one selected XML file from a stored
MPB/MBP source.

## Storage Tables

The web service creates these SQL tables automatically in the configured D1
database:

| Table | Purpose |
| --- | --- |
| `mp_source_files` | One row per original uploaded source file. Stores metadata for the exact R2 object, including original filename, extension, content type, byte size, SHA-256 hash, processing status/message, and extracted pack count. |
| `mp_imports` | One row per imported management pack file/version. Uses `management_pack_id INTEGER PRIMARY KEY AUTOINCREMENT`. The unique key is `system_name`, `version`, `source_file_name`, so different versions of the same MP can coexist. |
| `mp_import_references` | The MP reference aliases and referenced MP versions from `<References>`. |
| `mp_reference_elements` | Versioned element rows for ClassType, RelationshipType, module types, monitor types, rules, discoveries, tasks, overrides, views, resources, display strings, and knowledge articles. |

Important `mp_reference_elements` columns include `element_id`,
`element_type`, `section_key`, `group_name`, `display_name`, `description`,
`target`, `base`, `accessibility`, `enabled`, `category`, `parent`,
`detail_json`, `raw_xml`, and `searchable_text`.

## Modern JSON Endpoints

List imported packs:

```text
/api/mp/packs
/api/mp/packs?managementPack=Microsoft.SQLServer.Windows.Discovery&version=7.6.5.0
```

List available element types for a pack:

```text
/api/mp/types?managementPack=Microsoft.SQLServer.Windows.Discovery&version=7.6.5.0
```

List elements by type, section, version, or search text:

```text
/api/mp/elements?type=ClassType&managementPack=Microsoft.SQLServer.Windows.Discovery&version=7.6.5.0
/api/mp/elements?type=DataSourceModuleType&managementPack=Microsoft.SQLServer.Windows.Discovery&version=7.6.5.0&limit=25
/api/mp/elements?section=rules&managementPack=Microsoft.SQLServer.Windows.Monitoring&version=7.6.5.0&q=availability
```

Get one element:

```text
/api/mp/element?id=Microsoft.SQLServer.Windows.DBEngine&type=ClassType&managementPack=Microsoft.SQLServer.Windows.Discovery&version=7.6.5.0
```

## Catalog-Style Compatibility Endpoint

These mimic the archived catalog URLs in a JSON-friendly way:

```text
/api/wiki?GetCategory=Imported
/api/wiki?Get-ManagementPack=Microsoft.SQLServer.Windows.Monitoring&Version=7.6.5.0
/api/wiki?GetElements=ClassType&ManagementPack=Microsoft.SQLServer.Windows.Discovery&Version=7.6.5.0
/api/wiki?GetElements=RelationshipType&ManagementPack=Microsoft.SQLServer.Windows.Discovery&Version=7.6.5.0
/api/wiki?GetElements=DataSourceModuleType&ManagementPack=Microsoft.SQLServer.Windows.Discovery&Version=7.6.5.0
/api/wiki?GetElement=Microsoft.SQLServer.Windows.DBEngine&Type=ClassType&ManagementPack=Microsoft.SQLServer.Windows.Discovery&Version=7.6.5.0
```

## Parsed Element Families

The importer currently stores:

- Entity types: `ClassType`, `RelationshipType`.
- Type definitions and module types: `SchemaType`, `SecureReference`,
  `ConditionDetectionModuleType`, `DataSourceModuleType`,
  `ProbeActionModuleType`, `WriteActionModuleType`.
- Monitor types and workflows: `UnitMonitorType`, `AggregateMonitorType`,
  `Discovery`, `Rule`, `Task`, `AggregateMonitor`, `DependencyMonitor`,
  `UnitMonitor`.
- Overrides and categories: discovery, rule, and monitor overrides plus
  `Category`.
- Presentation/resources: `Folder`, `FolderItem`, `View`, `ConsoleTask`,
  `StringResource`, `ImageReference`, assemblies, reports, display strings,
  and knowledge articles.

The `detail_json` field keeps structured details such as class properties,
relationship source/target, overrideable parameters, monitor states, workflow
modules, alert settings, performance counters, event numbers, and raw resource
metadata.
