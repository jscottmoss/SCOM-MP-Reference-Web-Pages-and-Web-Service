export type CatalogCategory = {
  slug: string;
  name: string;
  count: number;
};

export type CategoryPack = {
  systemName: string;
  version: string;
  category: string;
};

export type MpReference = {
  alias: string;
  id: string;
  version: string;
  publicKeyToken?: string;
};

export type SectionTemplate = {
  key: string;
  title: string;
  types: string[];
  defaultColumns: string[];
};

export type MpElement = {
  id: string;
  section: string;
  type: string;
  displayName: string;
  target?: string;
  category?: string;
  enabled?: string;
  alertGenerate?: string;
  accessibility?: string;
  detail?: string;
};

export type ManagementPackSummary = {
  systemName: string;
  displayName: string;
  version: string;
  category: string;
  description: string;
  fileName?: string;
  sourceKind: "seed" | "xml" | "compiled";
  references: MpReference[];
  sectionCounts: Record<string, number>;
  elements: MpElement[];
};

export type ReferencePayload = {
  categories: CatalogCategory[];
  categoryPacks: CategoryPack[];
  packs: ManagementPackSummary[];
  sectionTemplates: SectionTemplate[];
  updatedAt: string;
};

export const sectionTemplates: SectionTemplate[] = [
  {
    key: "references",
    title: "References",
    types: ["Reference"],
    defaultColumns: ["Alias", "ID", "Version", "Public Key Token"],
  },
  {
    key: "classes-relationships",
    title: "Classes and Relationships",
    types: ["ClassType", "RelationshipType"],
    defaultColumns: ["DisplayName", "ID", "Base", "Accessibility"],
  },
  {
    key: "data-sources",
    title: "Data Sources",
    types: [
      "ConditionDetectionModuleType",
      "DataSourceModuleType",
      "ProbeActionModuleType",
      "WriteActionModuleType",
    ],
    defaultColumns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "monitor-types",
    title: "Monitor Types",
    types: ["UnitMonitorType", "AggregateMonitorType"],
    defaultColumns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "discoveries",
    title: "Discoveries",
    types: ["Discovery"],
    defaultColumns: ["DisplayName", "ID", "Target", "Enabled"],
  },
  {
    key: "rules",
    title: "Rules",
    types: ["Rule"],
    defaultColumns: [
      "DisplayName",
      "ID",
      "Target",
      "Category",
      "Enabled",
      "Alert Generate",
    ],
  },
  {
    key: "tasks",
    title: "Tasks",
    types: ["Task", "ConsoleTask"],
    defaultColumns: [
      "DisplayName",
      "ID",
      "Target",
      "Accessibility",
      "Category",
      "Enabled",
    ],
  },
  {
    key: "monitors",
    title: "Monitors",
    types: ["AggregateMonitor", "DependencyMonitor", "UnitMonitor"],
    defaultColumns: [
      "DisplayName",
      "ID",
      "Target",
      "Category",
      "Enabled",
      "Alert Generate",
      "Accessibility",
    ],
  },
  {
    key: "diagnostics-recoveries",
    title: "Diagnostics and Recoveries",
    types: ["Diagnostic", "Recovery"],
    defaultColumns: ["DisplayName", "ID", "Target", "Enabled"],
  },
  {
    key: "views",
    title: "Views",
    types: ["Folder", "FolderItem", "View"],
    defaultColumns: ["DisplayName", "ID", "Target", "Accessibility"],
  },
  {
    key: "string-resources",
    title: "String Resources",
    types: ["StringResource"],
    defaultColumns: ["DisplayName", "ID"],
  },
  {
    key: "reports",
    title: "Reports",
    types: ["DataWarehouseScript", "LinkedReport", "Report", "ReportResource"],
    defaultColumns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "display-strings",
    title: "Display Strings",
    types: ["DisplayString"],
    defaultColumns: ["DisplayName", "ID"],
  },
  {
    key: "knowledge-articles",
    title: "Knowledge Articles",
    types: ["KnowledgeArticle"],
    defaultColumns: ["DisplayName", "ID"],
  },
];

export const catalogCategories: CatalogCategory[] = [
  { slug: "A10 Management Pack", name: "A10 Management Pack", count: 1 },
  { slug: "Acer Smart Integration Pack", name: "Acer Smart Integration Pack", count: 8 },
  {
    slug: "Active Directory 2008 Audit Management Pack",
    name: "Active Directory 2008 Audit Management Pack",
    count: 1,
  },
  {
    slug: "Adobe Flash Mediaserver Management Pack for SCOM 2007",
    name: "Adobe Flash Mediaserver Management Pack for SCOM 2007",
    count: 1,
  },
  { slug: "Advanced Threat Analytics (ATA)", name: "Advanced Threat Analytics (ATA)", count: 7 },
  { slug: "Alert Management Pack", name: "Alert Management Pack", count: 1 },
  { slug: "Alert Storm Monitoring", name: "Alert Storm Monitoring", count: 2 },
  { slug: "Amazon Web Services Management Pack", name: "Amazon Web Services Management Pack", count: 1 },
  { slug: "Ambari SCOM Management Pack", name: "Ambari SCOM Management Pack", count: 3 },
  { slug: "Anywhere365 Management Pack", name: "Anywhere365 Management Pack", count: 1 },
  { slug: "Apache HTTP Server Management Pack", name: "Apache HTTP Server Management Pack", count: 1 },
  { slug: "Application Approval Workflow", name: "Application Approval Workflow", count: 4 },
  { slug: "AppSense Management Pack", name: "AppSense Management Pack", count: 12 },
  { slug: "AudioCodes SCOM Management Pack", name: "AudioCodes SCOM Management Pack", count: 1 },
  { slug: "Azure Stack", name: "Azure Stack", count: 1 },
  {
    slug: "Backbone End-User Performance Management Pack",
    name: "Backbone End-User Performance Management Pack",
    count: 4,
  },
  { slug: "BitLocker Administration", name: "BitLocker Administration", count: 2 },
  { slug: "BizTalk Server 2016", name: "BizTalk Server 2016", count: 4 },
  { slug: "Brocade HBA Management Pack", name: "Brocade HBA Management Pack", count: 2 },
  { slug: "Certificate Monitoring", name: "Certificate Monitoring", count: 1 },
  { slug: "Cireson Asset Management", name: "Cireson Asset Management", count: 8 },
  { slug: "Dell Storage Management Pack", name: "Dell Storage Management Pack", count: 6 },
  { slug: "Exchange Server", name: "Exchange Server", count: 42 },
  { slug: "Hyper-V", name: "Hyper-V", count: 22 },
  { slug: "Microsoft 365", name: "Microsoft 365", count: 12 },
  { slug: "SQL Server", name: "SQL Server", count: 73 },
  { slug: "Windows Server", name: "Windows Server", count: 88 },
];

export const sqlCategoryPacks: CategoryPack[] = [
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2000.Discovery", version: "6.0.6648.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2000.Monitoring", version: "6.0.6648.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2005.Discovery", version: "6.7.2.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2005.Monitoring", version: "6.7.2.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2008.Discovery", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2008.Mirroring.Discovery", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2008.Mirroring.Monitoring", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2008.Monitoring", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2008.Presentation", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2012.AlwaysOn.Discovery", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2012.AlwaysOn.Monitoring", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2012.Discovery", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2012.Monitoring", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2014.Discovery", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2014.Monitoring", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2016.Discovery", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2016.Monitoring", version: "7.0.15.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2017.Windows.Discovery", version: "6.7.60.0" },
  { category: "SQL Server", systemName: "Microsoft.SQLServer.2017.Windows.Monitoring", version: "6.7.60.0" },
];

const discoveryElements: MpElement[] = [
  {
    section: "discoveries",
    type: "Discovery",
    displayName: "MSSQL 2017 on Windows: Discover SQL Server 2017 Agent for a Database Engine",
    id: "Microsoft.SQLServer.2017.Windows.Discovery.Agent",
    target: "Microsoft.SQLServer.2017.Windows.DBEngine",
    enabled: "True",
  },
  {
    section: "discoveries",
    type: "Discovery",
    displayName: "MSSQL 2017 on Windows: Discover SQL Server 2017 Agent Jobs",
    id: "Microsoft.SQLServer.2017.Windows.Discovery.AgentJob",
    target: "Microsoft.SQLServer.2017.Windows.Agent",
    enabled: "False",
  },
  {
    section: "discoveries",
    type: "Discovery",
    displayName: "MSSQL 2017 on Windows: Discover Memory-Optimized Data Filegroup Containers",
    id: "Microsoft.SQLServer.2017.Windows.Discovery.Container",
    target: "Microsoft.SQLServer.2017.Windows.DBFilegroupFx",
    enabled: "True",
  },
  {
    section: "discoveries",
    type: "Discovery",
    displayName: "MSSQL 2017 on Windows: Discover SQL Server 2017 Databases for a Database Engine",
    id: "Microsoft.SQLServer.2017.Windows.Discovery.Database",
    target: "Microsoft.SQLServer.2017.Windows.DBEngine",
    enabled: "True",
  },
  {
    section: "discoveries",
    type: "Discovery",
    displayName: "MSSQL 2017 on Windows: Discover SQL Server 2017 Database Engines",
    id: "Microsoft.SQLServer.2017.Windows.Discovery.DBEngine",
    target: "Microsoft.SQLServer.2017.Windows.DBEngineSeed",
    enabled: "True",
  },
  {
    section: "rules",
    type: "Rule",
    displayName: "MSSQL 2017 on Windows: Discovery error",
    id: "Microsoft.SQLServer.2017.Windows.Rule.MonitoringPoolAlertCollection.DiscoveryError",
    target: "Microsoft.SQLServer.2017.Windows.MonitoringPoolAlertCollection",
    category: "Alert",
    enabled: "True",
    alertGenerate: "True",
  },
  {
    section: "rules",
    type: "Rule",
    displayName: "MSSQL 2017 on Windows: Discovery warning",
    id: "Microsoft.SQLServer.2017.Windows.Rule.MonitoringPoolAlertCollection.DiscoveryWarning",
    target: "Microsoft.SQLServer.2017.Windows.MonitoringPoolAlertCollection",
    category: "Alert",
    enabled: "True",
    alertGenerate: "True",
  },
];

const discoveryClasses: MpElement[] = [
  "Microsoft.SQLServer.2017.Windows.Agent",
  "Microsoft.SQLServer.2017.Windows.LocalAgent",
  "Microsoft.SQLServer.2017.Windows.AgentJob",
  "Microsoft.SQLServer.2017.Windows.LocalAgentJob",
  "Microsoft.SQLServer.2017.Windows.Database",
  "Microsoft.SQLServer.2017.Windows.LocalDatabase",
  "Microsoft.SQLServer.2017.Windows.MonitoringPoolAlertCollection",
  "Microsoft.SQLServer.2017.Windows.LocalDiscoverySeed",
  "Microsoft.SQLServer.2017.Windows.DBEngineExpressGroup",
  "Microsoft.SQLServer.2017.Windows.DBEngineGroup",
  "Microsoft.SQLServer.2017.Windows.Container",
  "Microsoft.SQLServer.2017.Windows.DBFile",
].map((id) => ({
  id,
  section: "classes-relationships",
  type: "ClassType",
  displayName: id,
  accessibility: "Public",
}));

const monitoringMonitors: MpElement[] = [
  {
    displayName: "Source Log Shipping",
    id: "Microsoft.SQLServer.2017.Windows.Database.LogShippingSourceMonitor",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    category: "PerformanceHealth",
    enabled: "True",
    alertGenerate: "True",
    accessibility: "Public",
  },
  {
    displayName: "DMV Configuration Status",
    id: "Microsoft.SQLServer.2017.Windows.DBEngine.Configuration.DMVConfigMonitor",
    target: "Microsoft.SQLServer.2017.Windows.DBEngine",
    category: "AvailabilityHealth",
    enabled: "True",
    alertGenerate: "True",
    accessibility: "Public",
  },
  {
    displayName: "Service Principal Name Configuration Status",
    id: "Microsoft.SQLServer.2017.Windows.DBEngine.Configuration.SPNStatusMonitor",
    target: "Microsoft.SQLServer.2017.Windows.LocalDBEngine",
    category: "AvailabilityHealth",
    enabled: "True",
    alertGenerate: "True",
    accessibility: "Public",
  },
  {
    displayName: "Long Running Jobs",
    id: "Microsoft.SQLServer.2017.Windows.Monitor.Agent.LongRunningJobs",
    target: "Microsoft.SQLServer.2017.Windows.Agent",
    category: "PerformanceHealth",
    enabled: "False",
    alertGenerate: "True",
    accessibility: "Public",
  },
  {
    displayName: "SQL Server Agent Service",
    id: "Microsoft.SQLServer.2017.Windows.Monitor.Agent.ServiceStatus",
    target: "Microsoft.SQLServer.2017.Windows.Agent",
    category: "PerformanceHealth",
    enabled: "True",
    alertGenerate: "True",
    accessibility: "Public",
  },
  {
    displayName: "Database Backup Status",
    id: "Microsoft.SQLServer.2017.Windows.Monitor.Database.DBBackupStatus",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    category: "AvailabilityHealth",
    enabled: "True",
    alertGenerate: "True",
    accessibility: "Public",
  },
].map((element) => ({ ...element, section: "monitors", type: "UnitMonitor" }));

const monitoringRules: MpElement[] = [
  {
    displayName: "MSSQL 2017 on Windows: DB Active Transactions Count",
    id: "Microsoft.SQLServer.2017.Windows.CollectionRule.Database.ActiveTransactions",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    category: "PerformanceCollection",
    enabled: "True",
    alertGenerate: "False",
  },
  {
    displayName: "MSSQL 2017 on Windows: DB Active Connections Count",
    id: "Microsoft.SQLServer.2017.Windows.CollectionRule.Database.DBActiveConnectionsCount",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    category: "PerformanceCollection",
    enabled: "True",
    alertGenerate: "False",
  },
  {
    displayName: "MSSQL 2017 on Windows: DB Disk Read Latency (ms)",
    id: "Microsoft.SQLServer.2017.Windows.CollectionRule.Database.DBDiskReadLatency",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    category: "PerformanceCollection",
    enabled: "True",
    alertGenerate: "False",
  },
  {
    displayName: "MSSQL 2017 on Windows: Monitoring error",
    id: "Microsoft.SQLServer.2017.Windows.Rule.MonitoringPoolAlertCollection.MonitoringError",
    target: "Microsoft.SQLServer.2017.Windows.MonitoringPoolAlertCollection",
    category: "Alert",
    enabled: "True",
    alertGenerate: "True",
  },
].map((element) => ({ ...element, section: "rules", type: "Rule" }));

const monitoringTasks: MpElement[] = [
  {
    displayName: "Check Disk (DBCC)",
    id: "Microsoft.SQLServer.2017.Windows.Task.Database.DBCCCheckAlloc",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    accessibility: "Internal",
    category: "Maintenance",
    enabled: "True",
  },
  {
    displayName: "Check Database (DBCC)",
    id: "Microsoft.SQLServer.2017.Windows.Task.Database.DBCCCheckDB",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    accessibility: "Internal",
    category: "Maintenance",
    enabled: "True",
  },
  {
    displayName: "Set Database Offline",
    id: "Microsoft.SQLServer.2017.Windows.Task.Database.SetDBOffline",
    target: "Microsoft.SQLServer.2017.Windows.Database",
    accessibility: "Internal",
    category: "Maintenance",
    enabled: "True",
  },
  {
    displayName: "Start SQL Agent Service",
    id: "Microsoft.SQLServer.2017.Windows.Task.LocalAgent.StartService",
    target: "Microsoft.SQLServer.2017.Windows.LocalAgent",
    accessibility: "Internal",
    category: "Maintenance",
    enabled: "True",
  },
].map((element) => ({ ...element, section: "tasks", type: "Task" }));

export const seedPacks: ManagementPackSummary[] = [
  {
    systemName: "Microsoft.SQLServer.2017.Windows.Discovery",
    displayName: "Microsoft SQL Server 2017 on Windows (Discovery)",
    version: "6.7.60.0",
    category: "SQL Server",
    sourceKind: "seed",
    fileName: "Microsoft.SQLServer.2017.Windows.Discovery.mpb",
    description:
      "Discovers Microsoft SQL Server 2017 and related objects on Windows. It requires the SQL Server 2017 Core Library Management Pack and the separate monitoring management pack for monitoring.",
    references: [
      { alias: "System", id: "System.Library", version: "7.5.8501.0" },
      { alias: "Windows", id: "Microsoft.Windows.Library", version: "7.5.8501.0" },
      { alias: "SQLCore", id: "Microsoft.SQLServer.2017.Library", version: "6.7.60.0" },
    ],
    sectionCounts: {
      "classes-relationships": 47,
      "data-sources": 31,
      "discoveries": 19,
      "rules": 2,
      "string-resources": 2,
    },
    elements: [...discoveryClasses, ...discoveryElements],
  },
  {
    systemName: "Microsoft.SQLServer.2017.Windows.Monitoring",
    displayName: "Microsoft SQL Server 2017 on Windows (Monitoring)",
    version: "6.7.60.0",
    category: "SQL Server",
    sourceKind: "seed",
    fileName: "Microsoft.SQLServer.2017.Windows.Monitoring.mpb",
    description:
      "Enables monitoring of Microsoft SQL Server 2017 on Windows. This management pack depends on the SQL Server 2017 Windows Discovery and Core Library management packs.",
    references: [
      { alias: "System", id: "System.Library", version: "7.5.8501.0" },
      { alias: "Health", id: "System.Health.Library", version: "7.0.8438.6" },
      { alias: "SQLDiscovery", id: "Microsoft.SQLServer.2017.Windows.Discovery", version: "6.7.60.0" },
    ],
    sectionCounts: {
      "data-sources": 96,
      "monitor-types": 38,
      "monitors": 91,
      "rules": 431,
      "tasks": 22,
      "reports": 0,
    },
    elements: [...monitoringMonitors, ...monitoringRules, ...monitoringTasks],
  },
];

export const referencePayload: ReferencePayload = {
  categories: catalogCategories,
  categoryPacks: sqlCategoryPacks,
  packs: seedPacks,
  sectionTemplates,
  updatedAt: "2026-07-11",
};

export function findSectionByType(type: string) {
  return sectionTemplates.find((section) => section.types.includes(type));
}

export function emptyCounts() {
  return Object.fromEntries(sectionTemplates.map((section) => [section.key, 0]));
}
