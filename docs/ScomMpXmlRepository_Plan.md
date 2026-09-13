# SCOM Management Pack XML Repository Plan

## Source Files Reviewed

These files were inspected directly:

| Source XML | MP identity | MP version | Approx size | Main content |
| --- | --- | ---: | ---: | --- |
| `Microsoft.SQLServer.Visualization.Library.xml` | `Microsoft.SQLServer.Visualization.Library` | `7.6.2.0` | 309 KB | visualization schemas, component types, resources, one DW script |
| `Microsoft.SQLServer.Windows.Discovery.xml` | `Microsoft.SQLServer.Windows.Discovery` | `7.6.5.0` | 942 KB | SQL Server Windows class/relationship definitions, discoveries, discovery modules |
| `Microsoft.SQLServer.Windows.Monitoring.xml` | `Microsoft.SQLServer.Windows.Monitoring` | `7.6.5.0` | 13.8 MB | rules, monitors, monitor types, module types, overrides, console tasks |

The schema below does not require the SCOM SDK. It assumes a parser will read the XML files with normal XML tooling and insert rows into SQL Server.

## Versioning Design

The repository uses three version-safe levels:

1. `mp.ManagementPackIdentity`
   Stores the logical MP identity: `system_name` plus `public_key_token`.

2. `mp.ManagementPackVersion`
   Stores a specific declared MP version for that identity.

3. `mp.ManagementPackImport`
   Stores one physical imported XML file, including source file name, path, hash, import date, and raw XML.

Every parsed object table ultimately points to `import_id`, not just the MP name. This means all of these cases work cleanly:

- same file name, different MP versions
- same MP name, different MP versions
- same MP version imported from different folders
- duplicate imports kept for audit/testing
- side-by-side comparison of SQL Server MP 7.6.5.0 and future versions

## Core Tables

### Import Metadata

- `mp.ManagementPackIdentity`
- `mp.ManagementPackVersion`
- `mp.ManagementPackImport`
- `mp.ManagementPackReference`

Use these to answer:

- Which MPs were loaded?
- Which file did this row come from?
- What version of the same MP is this?
- What MP aliases and dependencies were declared in the Manifest?

### Generic Element Catalog

- `mp.MpElement`
- `mp.ElementAttribute`
- `mp.ElementXmlFragment`

Every meaningful MP object gets one `MpElement` row. Specialized tables then hang from it. This gives one consistent place for:

- XML ID
- section name
- element kind
- display name and description after language-pack resolution
- target reference
- category
- raw XML fragment

The attribute and fragment tables preserve fields that are not modeled yet, so the parser does not lose information when Microsoft adds new MP element shapes.

## TypeDefinitions Tables

These tables store reusable definitions from `<TypeDefinitions>`:

- `mp.ClassType`
- `mp.ClassProperty`
- `mp.RelationshipType`
- `mp.SchemaType`
- `mp.SecureReference`
- `mp.ModuleType`
- `mp.OverrideableParameter`
- `mp.MonitorType`
- `mp.MonitorTypeState`

The Discovery MP requires class and relationship support. The Monitoring MP requires module and monitor type support. The Visualization MP requires schema, secure reference, and component-related support.

## Monitoring Tables

These tables store runtime workflows from `<Monitoring>`:

- `mp.Rule`
- `mp.Discovery`
- `mp.DiscoveryTypeMapping`
- `mp.Monitor`
- `mp.MonitorOperationalState`
- `mp.AlertParameter`
- `mp.Task`
- `mp.ConsoleTask`
- `mp.Override`
- `mp.WorkflowModule`
- `mp.ConfigurationValue`

`WorkflowModule` is intentionally generic. Rules, discoveries, monitors, tasks, module types, and monitor types all contain nested module references such as `DataSource`, `ConditionDetection`, `WriteAction`, and `ProbeAction`. Rather than creating hundreds of static columns for SQL-specific configuration fields, the design stores:

- the module type reference
- the module role
- the module order
- raw module XML
- parsed configuration key/value rows in `mp.ConfigurationValue`

That is important for these SQL Server MPs because module configuration fields include many product-specific names such as `InstanceName`, `DatabaseName`, `SqlTimeoutSeconds`, `Threshold`, `ObjectName`, `CounterName`, `ExcludedDBs`, `TopQueries`, and many more.

## Presentation, Language, Resource, and Reporting Tables

These tables store the non-monitoring sections:

- `mp.Category`
- `mp.ViewDefinition`
- `mp.Folder`
- `mp.FolderItem`
- `mp.StringResource`
- `mp.ComponentType`
- `mp.ComponentImplementation`
- `mp.ComponentBehavior`
- `mp.ImageReference`
- `mp.LanguagePack`
- `mp.LocalizedText`
- `mp.KnowledgeArticle`
- `mp.ResourceDefinition`
- `mp.ResourceDependency`
- `mp.DataWarehouseScript`
- `mp.ReportDefinition`

The SQL Server Visualization Library especially needs the component, schema, resource, and data warehouse script tables. The SQL Server Monitoring MP heavily uses localized text and knowledge articles.

## Import Strategy Without SCOM SDK

1. Load raw XML into `mp.ManagementPackImport.raw_xml`.
2. Read `Manifest/Identity` into identity/version tables.
3. Read `Manifest/References/Reference` into `mp.ManagementPackReference`.
4. Walk known XML paths and insert each object into `mp.MpElement`.
5. Insert type-specific rows into the specialized table.
6. Insert all XML attributes into `mp.ElementAttribute`.
7. Insert important child XML or child text into `mp.ElementXmlFragment`.
8. Insert module configuration children into `mp.ConfigurationValue`.
9. Insert language pack display strings into `mp.LocalizedText`.
10. Backfill `MpElement.display_name` and `MpElement.description` from localized text where `element_ref = xml_id`.

## Key Parsing Paths

Use these paths as the first parser targets:

```text
/ManagementPack/Manifest/Identity
/ManagementPack/Manifest/References/Reference
/ManagementPack/TypeDefinitions/EntityTypes/ClassTypes/ClassType
/ManagementPack/TypeDefinitions/EntityTypes/RelationshipTypes/RelationshipType
/ManagementPack/TypeDefinitions/ModuleTypes/*
/ManagementPack/TypeDefinitions/MonitorTypes/UnitMonitorType
/ManagementPack/Monitoring/Rules/Rule
/ManagementPack/Monitoring/Discoveries/Discovery
/ManagementPack/Monitoring/Monitors/*
/ManagementPack/Monitoring/Tasks/Task
/ManagementPack/Monitoring/Overrides/*
/ManagementPack/Presentation/Views/View
/ManagementPack/Presentation/ConsoleTasks/ConsoleTask
/ManagementPack/Presentation/StringResources/StringResource
/ManagementPack/LanguagePacks/LanguagePack/DisplayStrings/DisplayString
/ManagementPack/LanguagePacks/LanguagePack/KnowledgeArticles/KnowledgeArticle
/ManagementPack/Resources/*
```

## Notes For Querying

- Keep reference values exactly as written, for example `System!System.Entity` or `Microsoft.SQLServer.Windows.DBEngine`.
- Later, a resolver can split `Alias!ElementName` and join through `ManagementPackReference`.
- Store `Enabled` as both raw text and a nullable bit. MPs can use more than just `true`/`false`.
- Store nested module config as key/value rows. This is more durable than trying to predict every SQL Server MP configuration field.
- Store raw XML for every object. That gives you a complete escape hatch when a new MP version adds a field not yet normalized.

## SQL Script

The table creation script is:

```text
sql/ScomMpXmlRepository_CreateTables.sql
```

