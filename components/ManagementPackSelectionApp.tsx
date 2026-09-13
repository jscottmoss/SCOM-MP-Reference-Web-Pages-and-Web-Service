"use client";

import { useEffect, useMemo, useState } from "react";
import type { SectionTemplate } from "@/lib/reference-data";

type ImportedPackSummary = {
  managementPackId: number;
  systemName: string;
  displayName: string;
  version: string;
  category: string;
  description: string;
  fileName?: string;
  sourceKind: "xml" | "compiled";
  sectionCounts: Record<string, number>;
  elementTypeCounts?: Record<string, number>;
  r2Key?: string;
  sourceFileId?: string;
  sourceFileName?: string;
  sourceFileExtension?: string;
  sourceFileSize?: number;
  sourceFileSha256?: string;
  sourceFileStatus?: string;
  importedAt?: string;
};

type MpReference = {
  alias: string;
  id: string;
  version: string;
  publicKeyToken?: string;
};

type PackDetail = ImportedPackSummary & {
  references: MpReference[];
};

type ServiceElement = {
  elementRowId: number;
  managementPackId: number;
  systemName: string;
  version: string;
  id: string;
  type: string;
  section: string;
  group: string;
  displayName: string;
  description?: string;
  target?: string;
  base?: string;
  accessibility?: string;
  enabled?: string;
  category?: string;
  parent?: string;
  detail: Record<string, unknown>;
  rawXml?: string;
};

type ElementTableGroup = {
  key: string;
  title: string;
  types: string[];
  elements: ServiceElement[];
  columns: string[];
  showType?: boolean;
};

type ElementTableDefinition = Omit<ElementTableGroup, "elements">;

type ElementGroupVisibility = Record<string, boolean>;

type Props = {
  initialManagementPack?: string;
  initialVersion?: string;
  sectionTemplates: SectionTemplate[];
};

function totalFromCounts(counts?: Record<string, number>) {
  return Object.values(counts ?? {}).reduce((total, count) => total + count, 0);
}

function totalElementsForPack(pack?: Pick<ImportedPackSummary, "elementTypeCounts" | "sectionCounts"> | null) {
  const typeTotal = totalFromCounts(pack?.elementTypeCounts);

  if (typeTotal > 0) {
    return typeTotal;
  }

  const { references: _references, ...sectionCounts } = pack?.sectionCounts ?? {};
  return totalFromCounts(sectionCounts);
}

function formatImportedAt(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(/[^0-9]+/).filter(Boolean).map(Number);
  const rightParts = right.split(/[^0-9]+/).filter(Boolean).map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return left.localeCompare(right);
}

function selectionHref(pack: Pick<ImportedPackSummary, "systemName" | "version">) {
  return `/management-pack-selection?managementPack=${encodeURIComponent(
    pack.systemName
  )}&version=${encodeURIComponent(pack.version)}`;
}

function managementPackLabel(pack: Pick<ImportedPackSummary, "displayName" | "systemName">) {
  if (pack.displayName && pack.displayName !== pack.systemName) {
    return `${pack.displayName} (${pack.systemName})`;
  }

  return pack.systemName;
}

function sourceFileName(
  pack: Pick<ImportedPackSummary, "fileName" | "r2Key" | "sourceFileName">
) {
  if (pack.sourceFileName) {
    return pack.sourceFileName;
  }

  const keyFileName = pack.r2Key?.split("/").filter(Boolean).at(-1);
  return keyFileName || pack.fileName || "";
}

function sourceExtension(
  pack: Pick<
    ImportedPackSummary,
    "fileName" | "r2Key" | "sourceFileName" | "sourceFileExtension"
  >
) {
  return (
    pack.sourceFileExtension ||
    sourceFileName(pack).match(/\.([^.]+)$/)?.[1]?.toLowerCase() ||
    ""
  );
}

function downloadHref(
  pack: Pick<ImportedPackSummary, "managementPackId" | "systemName" | "version">,
  format: "xml" | "source"
) {
  const params = new URLSearchParams({
    managementPackId: String(pack.managementPackId),
    managementPack: pack.systemName,
    version: pack.version,
    format,
  });

  return `/api/mp/download?${params.toString()}`;
}

function sourceDownloadHref(
  pack: Pick<
    ImportedPackSummary,
    "managementPackId" | "systemName" | "version" | "sourceFileId"
  >
) {
  if (pack.sourceFileId) {
    return `/api/files/download?sourceFileId=${encodeURIComponent(pack.sourceFileId)}`;
  }

  return downloadHref(pack, "source");
}

function sourceDownloadLabel(
  pack: Pick<
    ImportedPackSummary,
    "fileName" | "r2Key" | "sourceKind" | "sourceFileName" | "sourceFileExtension"
  >
) {
  const extension = sourceExtension(pack);

  if (extension === "mp") {
    return "Download MP";
  }

  if (extension === "mpb" || extension === "mbp") {
    return "Download MPB";
  }

  if (pack.sourceKind === "compiled") {
    return "Download Source File";
  }

  return "";
}

function formatBytes(value?: number) {
  if (!value || value <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function shortHash(value?: string) {
  if (!value) {
    return "";
  }

  return value.length > 20 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

function elementHref(element: Pick<ServiceElement, "id" | "type" | "systemName" | "version">) {
  const params = new URLSearchParams({
    managementPack: element.systemName,
    version: element.version,
    id: element.id,
    type: element.type,
  });

  return `/management-pack-element?${params.toString()}`;
}

function stringifyDetail(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function detailRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function detailAttribute(element: ServiceElement, key: string) {
  const attributes = detailRecord(element.detail.attributes);
  const value =
    attributes[key] ??
    Object.entries(attributes).find(
      ([attributeKey]) => attributeKey.toLowerCase() === key.toLowerCase()
    )?.[1];

  return stringifyDetail(value);
}

function relationshipValue(element: ServiceElement, key: string) {
  const relationship = detailRecord(element.detail.relationship);
  return stringifyDetail(relationship[key]);
}

function formatBooleanValue(value: string, fallback = "") {
  if (!value) {
    return fallback;
  }

  if (value.toLowerCase() === "true") {
    return "True";
  }

  if (value.toLowerCase() === "false") {
    return "False";
  }

  return value;
}

function classGroupValue(element: ServiceElement) {
  const explicit = detailAttribute(element, "Group");

  if (explicit) {
    return formatBooleanValue(explicit);
  }

  const base = element.base ?? detailAttribute(element, "Base");
  const classText = `${element.id} ${base}`;
  return /\bSystem\.Group\b|\.Group\b|Group$/i.test(classText) ? "True" : "False";
}

function alertGenerateValue(element: ServiceElement) {
  const candidate =
    element.detail.generatedAlert ??
    element.detail.alertSettings ??
    element.detail.alertGenerate;

  if (!candidate) {
    return "";
  }

  if (typeof candidate === "object") {
    return "True";
  }

  return stringifyDetail(candidate);
}

function resourceValue(element: ServiceElement, key: string) {
  const resource = detailRecord(element.detail.resource);
  return stringifyDetail(resource[key]);
}

function overrideValue(element: ServiceElement, key: string) {
  const override = detailRecord(element.detail.override);
  return stringifyDetail(override[key]);
}

function getColumnValue(element: ServiceElement, column: string) {
  switch (column) {
    case "DisplayName":
      return element.displayName;
    case "ID":
      return element.id;
    case "Target":
      return (
        overrideValue(element, "target") ||
        element.target ||
        relationshipValue(element, "targetType") ||
        relationshipValue(element, "targetId") ||
        detailAttribute(element, "Target")
      );
    case "Source":
      return (
        relationshipValue(element, "sourceType") ||
        relationshipValue(element, "sourceId") ||
        detailAttribute(element, "Source")
      );
    case "Base":
      return element.base ?? element.target ?? "";
    case "Base Class":
      return element.base || detailAttribute(element, "Base");
    case "Category":
      return element.category ?? "";
    case "Enabled":
      return element.enabled ? formatBooleanValue(element.enabled) : "";
    case "Alert Generate":
      return alertGenerateValue(element);
    case "Accessibility":
      return element.accessibility ?? "";
    case "Abstract":
      return formatBooleanValue(detailAttribute(element, "Abstract"), "False");
    case "Hosted":
      return formatBooleanValue(detailAttribute(element, "Hosted"), "False");
    case "Singleton":
      return formatBooleanValue(detailAttribute(element, "Singleton"), "False");
    case "Group":
      return classGroupValue(element);
    case "Extension":
      return formatBooleanValue(detailAttribute(element, "Extension"), "False");
    case "Isolation":
      return detailAttribute(element, "Isolation") || "Any";
    case "Algorithm":
      return detailAttribute(element, "Algorithm");
    case "Context":
      return overrideValue(element, "context") || detailAttribute(element, "Context");
    case "Type":
      return element.base || detailAttribute(element, "TypeID") || detailAttribute(element, "Type");
    case "Type Definition":
      return (
        detailAttribute(element, "TypeDefinition") ||
        detailAttribute(element, "TypeDefinitionID") ||
        detailAttribute(element, "Type")
      );
    case "FolderName":
      return detailAttribute(element, "Folder") || detailAttribute(element, "FolderName");
    case "ElementID":
      return detailAttribute(element, "ElementID");
    case "ParentFolder":
      return (
        detailAttribute(element, "ParentFolder") ||
        detailAttribute(element, "Parent") ||
        element.parent ||
        ""
      );
    case "ImageID":
      return detailAttribute(element, "ImageID");
    case "Visible":
      return formatBooleanValue(detailAttribute(element, "Visible"));
    case "Behavior Type":
      return detailAttribute(element, "BehaviorType") || detailAttribute(element, "Type");
    case "Component Type":
      return detailAttribute(element, "ComponentType");
    case "Platform":
      return detailAttribute(element, "Platform");
    case "Parent":
      return element.parent || detailAttribute(element, "Parent");
    case "File Name":
      return resourceValue(element, "fileName") || detailAttribute(element, "FileName");
    case "Parameter":
      return overrideValue(element, "parameter") || detailAttribute(element, "Parameter");
    case "Property":
      return overrideValue(element, "property") || detailAttribute(element, "Property");
    case "Value":
      return overrideValue(element, "value");
    case "Enforced":
      return formatBooleanValue(
        overrideValue(element, "enforced") || detailAttribute(element, "Enforced")
      );
    default:
      return element.description ?? "";
  }
}

function classIconFile(element: ServiceElement) {
  const base = (element.base ?? detailAttribute(element, "Base")).toLowerCase();
  const id = element.id.toLowerCase();

  if (classGroupValue(element) === "True") {
    return "GenericGroup16.png";
  }

  if (id.includes("localapplication") || base.includes("localapplication")) {
    return "GenericLocalApplication16.png";
  }

  if (id.includes("component") || base.includes("applicationcomponent")) {
    return "ApplicationComponent16.png";
  }

  return "GenericBaseEntity16.png";
}

function elementIconFile(element: ServiceElement) {
  if (element.type === "ClassType") {
    return classIconFile(element);
  }

  const iconByType: Record<string, string> = {
    AggregateMonitor: "AgregateMonitor.png",
    AggregateMonitorType: "AgregateMonitor.png",
    AlertViewType: "AlertViewType.png",
    Assembly: "Assembly.png",
    Category: "Category.png",
    ComponentBehavior: "Component.png",
    ComponentImplementation: "Component.png",
    ComponentReference: "Component.png",
    ComponentType: "Component.png",
    ConditionDetectionModuleType: "ConditionDetectionModuleType.png",
    ConsoleTask: "ConsoleTask.png",
    DataSourceModuleType: "DataSourceModuleType.png",
    DataWarehouseScript: "Assembly.png",
    DeployableAssembly: "Assembly.png",
    DependencyMonitor: "DependencyMonitor.png",
    Diagnostic: "Override.png",
    DiscoveryPropertyOverride: "Override.png",
    Discovery: "Discovery.png",
    DisplayString: "ShowReferences.png",
    Folder: "Folder.png",
    FolderItem: "Folder.png",
    Image: "ImageReference.png",
    ImageReference: "ImageReference.png",
    LinkedReport: "Assembly.png",
    MonitorConfigurationOverride: "Override.png",
    MonitorPropertyOverride: "Override.png",
    ProbeActionModuleType: "ProbeActionModuleType.png",
    Recovery: "Override.png",
    RelationshipType: "RelationshipType.png",
    Report: "Assembly.png",
    ReportResource: "Assembly.png",
    Resource: "Assembly.png",
    Rule: "Rule.png",
    RuleConfigurationOverride: "Override.png",
    RulePropertyOverride: "Override.png",
    SchemaType: "SchemaType.png",
    SecureReference: "SecureReference.png",
    StringResource: "ShowReferences.png",
    Task: "Tasks.png",
    TaskStatusViewType: "TaskStatusViewType.png",
    Template: "Template.png",
    UIPage: "UIPage.png",
    UIPageSet: "UIPageSet.png",
    UnitMonitor: "UnitMonitor.png",
    UnitMonitorType: "UnitMonitorType.png",
    WriteActionModuleType: "WriteActionModuleType.png",
  };

  return iconByType[element.type];
}

const elementTableDefinitions: ElementTableDefinition[] = [
  {
    key: "ClassType",
    title: "Classes",
    types: ["ClassType"],
    columns: [
      "DisplayName",
      "ID",
      "Base Class",
      "Abstract",
      "Hosted",
      "Singleton",
      "Group",
      "Extension",
      "Accessibility",
    ],
  },
  {
    key: "RelationshipType",
    title: "Relationship Types",
    types: ["RelationshipType"],
    columns: ["DisplayName", "ID", "Source", "Target", "Accessibility", "Abstract"],
  },
  {
    key: "DataSourceModuleType",
    title: "DataSource Modules",
    types: ["DataSourceModuleType"],
    columns: ["DisplayName", "ID", "Isolation", "Accessibility"],
  },
  {
    key: "ConditionDetectionModuleType",
    title: "ConditionDetection Modules",
    types: ["ConditionDetectionModuleType"],
    columns: ["DisplayName", "ID", "Isolation", "Accessibility"],
  },
  {
    key: "ProbeActionModuleType",
    title: "ProbeAction Modules",
    types: ["ProbeActionModuleType"],
    columns: ["DisplayName", "ID", "Isolation", "Accessibility"],
  },
  {
    key: "WriteActionModuleType",
    title: "WriteAction Modules",
    types: ["WriteActionModuleType"],
    columns: ["DisplayName", "ID", "Isolation", "Accessibility"],
  },
  {
    key: "SchemaType",
    title: "Schema Types",
    types: ["SchemaType"],
    columns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "SecureReference",
    title: "Secure References",
    types: ["SecureReference"],
    columns: ["DisplayName", "ID", "Context", "Accessibility"],
  },
  {
    key: "Category",
    title: "Categories",
    types: ["Category"],
    columns: ["ID", "Target"],
  },
  {
    key: "Discovery",
    title: "Discoveries",
    types: ["Discovery"],
    columns: ["DisplayName", "ID", "Target", "Enabled"],
  },
  {
    key: "AggregateMonitor",
    title: "Aggregate Monitors",
    types: ["AggregateMonitor"],
    columns: [
      "DisplayName",
      "ID",
      "Target",
      "Algorithm",
      "Category",
      "Enabled",
      "Alert Generate",
      "Accessibility",
    ],
  },
  {
    key: "DependencyMonitor",
    title: "Dependency Monitors",
    types: ["DependencyMonitor"],
    columns: [
      "DisplayName",
      "ID",
      "Target",
      "Algorithm",
      "Category",
      "Enabled",
      "Alert Generate",
      "Accessibility",
    ],
  },
  {
    key: "UnitMonitor",
    title: "Unit Monitors",
    types: ["UnitMonitor"],
    columns: [
      "DisplayName",
      "ID",
      "Target",
      "Type",
      "Category",
      "Enabled",
      "Alert Generate",
      "Accessibility",
    ],
  },
  {
    key: "AggregateMonitorType",
    title: "Aggregate Monitor Types",
    types: ["AggregateMonitorType"],
    columns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "UnitMonitorType",
    title: "Unit Monitor Types",
    types: ["UnitMonitorType"],
    columns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "Rule",
    title: "Rules",
    types: ["Rule"],
    columns: ["DisplayName", "ID", "Target", "Category", "Enabled", "Alert Generate"],
  },
  {
    key: "Task",
    title: "Agent Tasks",
    types: ["Task"],
    columns: ["DisplayName", "ID", "Target", "Accessibility", "Category", "Enabled"],
  },
  {
    key: "ConsoleTask",
    title: "Console Tasks",
    types: ["ConsoleTask"],
    columns: ["DisplayName", "ID", "Target", "Accessibility", "Enabled"],
  },
  {
    key: "Template",
    title: "Templates",
    types: ["Template"],
    columns: ["DisplayName", "ID"],
  },
  {
    key: "UIPage",
    title: "UI Pages",
    types: ["UIPage"],
    columns: ["ID", "Accessibility"],
  },
  {
    key: "UIPageSet",
    title: "UI Page Sets",
    types: ["UIPageSet"],
    columns: ["ID", "Type Definition"],
  },
  {
    key: "FolderItem",
    title: "Folder Items",
    types: ["FolderItem"],
    columns: ["DisplayName", "ID", "FolderName", "ElementID"],
  },
  {
    key: "Folder",
    title: "Folders",
    types: ["Folder"],
    columns: ["DisplayName", "ID", "ParentFolder", "Accessibility"],
  },
  {
    key: "ImageReference",
    title: "Image References",
    types: ["ImageReference"],
    columns: ["DisplayName", "ID", "ImageID"],
  },
  {
    key: "View",
    title: "Views",
    types: ["View"],
    columns: ["DisplayName", "ID", "Target", "Type", "Accessibility", "Visible"],
  },
  {
    key: "AlertViewType",
    title: "Alert View Types",
    types: ["AlertViewType"],
    columns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "TaskStatusViewType",
    title: "Task Status View Types",
    types: ["TaskStatusViewType"],
    columns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "ComponentBehavior",
    title: "Component Behaviors",
    types: ["ComponentBehavior"],
    columns: ["ID", "Behavior Type", "Component Type", "Accessibility"],
  },
  {
    key: "ComponentImplementation",
    title: "Component Implementations",
    types: ["ComponentImplementation"],
    columns: ["ID", "Type", "Platform", "Target", "Accessibility"],
  },
  {
    key: "ComponentReference",
    title: "Component References",
    types: ["ComponentReference"],
    columns: ["ID", "Type", "Parent", "Accessibility"],
  },
  {
    key: "ComponentType",
    title: "Component Types",
    types: ["ComponentType"],
    columns: ["DisplayName", "ID", "Accessibility"],
  },
  {
    key: "Assembly",
    title: "Assemblies",
    types: ["Assembly"],
    columns: ["ID", "File Name", "Accessibility"],
  },
  {
    key: "DeployableAssembly",
    title: "Deployable Assemblies",
    types: ["DeployableAssembly"],
    columns: ["ID", "File Name", "Accessibility"],
  },
  {
    key: "Image",
    title: "Images",
    types: ["Image"],
    columns: ["ID", "File Name", "Accessibility"],
  },
  {
    key: "Resource",
    title: "Resources",
    types: ["Resource"],
    columns: ["ID", "File Name", "Accessibility"],
  },
  {
    key: "Report",
    title: "Reports",
    types: ["DataWarehouseScript", "LinkedReport", "Report", "ReportResource"],
    columns: ["DisplayName", "ID", "Accessibility"],
    showType: true,
  },
  {
    key: "Override",
    title: "Overrides",
    types: [
      "DiscoveryPropertyOverride",
      "MonitorConfigurationOverride",
      "MonitorPropertyOverride",
      "RuleConfigurationOverride",
      "RulePropertyOverride",
    ],
    columns: ["ID", "Context", "Target", "Property", "Parameter", "Value", "Enforced"],
    showType: true,
  },
  {
    key: "DiagnosticRecovery",
    title: "Diagnostics and Recoveries",
    types: ["Diagnostic", "Recovery"],
    columns: ["DisplayName", "ID", "Target", "Enabled"],
    showType: true,
  },
  {
    key: "StringResource",
    title: "String Resources",
    types: ["StringResource", "DisplayString"],
    columns: ["DisplayName", "ID"],
    showType: true,
  },
  {
    key: "KnowledgeArticle",
    title: "Knowledge Articles",
    types: ["KnowledgeArticle"],
    columns: ["DisplayName", "ID"],
  },
];

function defaultElementGroupVisibility(): ElementGroupVisibility {
  return Object.fromEntries(
    elementTableDefinitions.map((definition) => [
      definition.key,
      definition.key !== "StringResource",
    ])
  );
}

function getElementTableGroups(elements: ServiceElement[]): ElementTableGroup[] {
  const grouped = elementTableDefinitions
    .map((definition) => ({
      ...definition,
      elements: elements.filter((element) => definition.types.includes(element.type)),
    }))
    .filter((group) => group.elements.length > 0);
  const groupedTypes = new Set(grouped.flatMap((group) => group.types));
  const otherElements = elements.filter((element) => !groupedTypes.has(element.type));

  if (!otherElements.length) {
    return grouped;
  }

  return [
    ...grouped,
    {
      key: "Other",
      title: "Other Elements",
      types: [],
      elements: otherElements,
      columns: ["DisplayName", "ID", "Target", "Accessibility"],
      showType: true,
    },
  ];
}

async function fetchImportedPacks() {
  const response = await fetch("/api/mp/packs");
  const payload = (await response.json()) as {
    packs?: ImportedPackSummary[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Imported management packs could not be loaded.");
  }

  return (payload.packs ?? [])
    .filter((pack) => totalFromCounts(pack.elementTypeCounts ?? pack.sectionCounts) > 0)
    .sort((left, right) => {
      const leftTime = left.importedAt ? new Date(left.importedAt).getTime() : 0;
      const rightTime = right.importedAt ? new Date(right.importedAt).getTime() : 0;
      return rightTime - leftTime || left.systemName.localeCompare(right.systemName);
    });
}

async function fetchPackDetail(systemName: string, version: string) {
  const response = await fetch(
    `/api/mp/packs?managementPack=${encodeURIComponent(
      systemName
    )}&version=${encodeURIComponent(version)}`
  );
  const payload = (await response.json()) as {
    pack?: PackDetail;
    error?: string;
  };

  if (!response.ok || payload.error || !payload.pack) {
    throw new Error(payload.error ?? "Management pack details could not be loaded.");
  }

  return payload.pack;
}

async function fetchElements(
  systemName: string,
  version: string,
  section: string,
  search: string
) {
  const params = new URLSearchParams({
    managementPack: systemName,
    version,
    section,
    limit: "5000",
  });

  if (search.trim()) {
    params.set("q", search.trim());
  }

  const response = await fetch(`/api/mp/elements?${params.toString()}`);
  const payload = (await response.json()) as {
    elements?: ServiceElement[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Management pack elements could not be loaded.");
  }

  return payload.elements ?? [];
}

export function ManagementPackSelectionApp({
  initialManagementPack,
  initialVersion,
  sectionTemplates,
}: Props) {
  const [packs, setPacks] = useState<ImportedPackSummary[]>([]);
  const [selectedPackName, setSelectedPackName] = useState(initialManagementPack ?? "");
  const [selectedPackVersion, setSelectedPackVersion] = useState(initialVersion ?? "");
  const [elementSearch, setElementSearch] = useState("");
  const [packDetail, setPackDetail] = useState<PackDetail | null>(null);
  const [elements, setElements] = useState<ServiceElement[]>([]);
  const [packStatus, setPackStatus] = useState("Loading imported management packs...");
  const [elementStatus, setElementStatus] = useState("");
  const [showReferences, setShowReferences] = useState(true);
  const [elementGroupVisibility, setElementGroupVisibility] = useState<ElementGroupVisibility>(
    () => defaultElementGroupVisibility()
  );

  const elementSections = useMemo(
    () => sectionTemplates.filter((section) => section.key !== "references"),
    [sectionTemplates]
  );

  useEffect(() => {
    let active = true;

    fetchImportedPacks()
      .then((nextPacks) => {
        if (!active) {
          return;
        }

        setPacks(nextPacks);

        const requested = nextPacks.find(
          (pack) =>
            pack.systemName === initialManagementPack &&
            (!initialVersion || pack.version === initialVersion)
        );
        const fallback = requested ?? nextPacks[0];

        if (fallback) {
          setSelectedPackName(fallback.systemName);
          setSelectedPackVersion(fallback.version);
          setPackStatus("");
        } else {
          setPackStatus("No imported management packs are available yet.");
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setPackStatus(
          error instanceof Error ? error.message : "Imported management packs could not be loaded."
        );
      });

    return () => {
      active = false;
    };
  }, [initialManagementPack, initialVersion, sectionTemplates]);

  const selectedPack = useMemo(
    () =>
      packs.find(
        (pack) =>
          pack.systemName === selectedPackName && pack.version === selectedPackVersion
      ) ?? null,
    [packs, selectedPackName, selectedPackVersion]
  );

  const packChoices = useMemo(() => {
    const latestByName = new Map<string, ImportedPackSummary>();

    for (const pack of packs) {
      const current = latestByName.get(pack.systemName);

      if (!current) {
        latestByName.set(pack.systemName, pack);
        continue;
      }

      const versionDiff = compareVersions(pack.version, current.version);
      const packTime = pack.importedAt ? new Date(pack.importedAt).getTime() : 0;
      const currentTime = current.importedAt ? new Date(current.importedAt).getTime() : 0;

      if (versionDiff > 0 || (versionDiff === 0 && packTime > currentTime)) {
        latestByName.set(pack.systemName, pack);
      }
    }

    return Array.from(latestByName.values()).sort((left, right) =>
      managementPackLabel(left).localeCompare(managementPackLabel(right))
    );
  }, [packs]);

  const versionChoices = useMemo(() => {
    const seenVersions = new Set<string>();

    return packs
      .filter((pack) => pack.systemName === selectedPackName)
      .sort((left, right) => {
        const versionDiff = compareVersions(right.version, left.version);
        const leftTime = left.importedAt ? new Date(left.importedAt).getTime() : 0;
        const rightTime = right.importedAt ? new Date(right.importedAt).getTime() : 0;

        return versionDiff || rightTime - leftTime;
      })
      .filter((pack) => {
        if (seenVersions.has(pack.version)) {
          return false;
        }

        seenVersions.add(pack.version);
        return true;
      });
  }, [packs, selectedPackName]);

  useEffect(() => {
    if (!selectedPack) {
      setPackDetail(null);
      return;
    }

    let active = true;
    setPackStatus("Loading management pack details...");
    setPackDetail(null);

    fetchPackDetail(selectedPack.systemName, selectedPack.version)
      .then((detail) => {
        if (!active) {
          return;
        }

        setPackDetail(detail);
        setPackStatus("");
        window.history.replaceState(null, "", selectionHref(detail));
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setPackDetail(null);
        setPackStatus(
          error instanceof Error ? error.message : "Management pack details could not be loaded."
        );
      });

    return () => {
      active = false;
    };
  }, [selectedPack]);

  useEffect(() => {
    if (!selectedPack) {
      setElements([]);
      return;
    }

    const populatedSections = elementSections
      .filter((section) => (selectedPack.sectionCounts[section.key] ?? 0) > 0)
      .map((section) => section.key);
    const sectionsToFetch = populatedSections.length
      ? populatedSections
      : elementSections.map((section) => section.key);

    if (!sectionsToFetch.length) {
      setElements([]);
      setElementStatus("");
      return;
    }

    let active = true;
    setElementStatus("Loading elements...");
    setElements([]);

    Promise.all(
      sectionsToFetch.map((section) =>
        fetchElements(
          selectedPack.systemName,
          selectedPack.version,
          section,
          elementSearch
        )
      )
    )
      .then((sectionElements) => {
        if (!active) {
          return;
        }

        setElements(sectionElements.flat());
        setElementStatus("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setElements([]);
        setElementStatus(
          error instanceof Error ? error.message : "Management pack elements could not be loaded."
        );
      });

    return () => {
      active = false;
    };
  }, [elementSearch, elementSections, selectedPack]);

  const displayedPack = packDetail ?? selectedPack;
  const totalDisplayedElementCount = totalElementsForPack(displayedPack);
  const elementGroups = getElementTableGroups(elements);
  const visibleElementGroups = elementGroups.filter(
    (group) => elementGroupVisibility[group.key] ?? true
  );
  const sourceDownloadText = displayedPack ? sourceDownloadLabel(displayedPack) : "";
  const storedSourceFileName = displayedPack ? sourceFileName(displayedPack) : "";
  const sourceSizeText = displayedPack ? formatBytes(displayedPack.sourceFileSize) : "";
  const sourceSha256Text = displayedPack ? shortHash(displayedPack.sourceFileSha256) : "";

  function chooseManagementPack(systemName: string) {
    const pack = packs
      .filter((candidate) => candidate.systemName === systemName)
      .sort((left, right) => {
        const versionDiff = compareVersions(right.version, left.version);
        const leftTime = left.importedAt ? new Date(left.importedAt).getTime() : 0;
        const rightTime = right.importedAt ? new Date(right.importedAt).getTime() : 0;

        return versionDiff || rightTime - leftTime;
      })[0];

    if (!pack) {
      return;
    }

    setSelectedPackName(pack.systemName);
    setSelectedPackVersion(pack.version);
    setElementSearch("");
  }

  function chooseVersion(version: string) {
    const pack =
      versionChoices.find((candidate) => candidate.version === version) ??
      packs.find(
        (candidate) =>
          candidate.systemName === selectedPackName && candidate.version === version
      );

    if (!pack) {
      return;
    }

    setSelectedPackName(pack.systemName);
    setSelectedPackVersion(pack.version);
    setElementSearch("");
  }

  function elementCountForGroup(group: ElementTableGroup) {
    if (elementSearch.trim()) {
      return group.elements.length;
    }

    return (
      group.types.reduce(
        (total, type) => total + (displayedPack?.elementTypeCounts?.[type] ?? 0),
        0
      ) || group.elements.length
    );
  }

  function setElementGroupShown(groupKey: string, shown: boolean) {
    setElementGroupVisibility((current) => ({
      ...current,
      [groupKey]: shown,
    }));
  }

  function renderElementIcon(element: ServiceElement) {
    const iconFile = elementIconFile(element);

    if (!iconFile) {
      return (
        <span className="ico" title={element.type}>
          {element.type.slice(0, 1)}
        </span>
      );
    }

    return (
      <img
        alt={element.id}
        className="mp-element-icon"
        src={`/mp-icons/${iconFile}`}
        title={element.type}
      />
    );
  }

  function renderColumnValue(element: ServiceElement, column: string, columns: string[]) {
    const value = getColumnValue(element, column);

    if (column === "DisplayName" || (column === "ID" && !columns.includes("DisplayName"))) {
      return (
        <a className="table-link" href={elementHref(element)}>
          {value || element.displayName || element.id}
        </a>
      );
    }

    return value;
  }

  function renderElementTable(
    tableElements: ServiceElement[],
    columns: string[],
    showType = true
  ) {
    return (
      <table className="table-striped DataTable element-table">
        <thead>
          <tr>
            <th>&nbsp;</th>
            {showType ? <th>Type</th> : null}
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableElements.map((element) => (
            <tr key={element.elementRowId}>
              <td>
                {renderElementIcon(element)}
              </td>
              {showType ? <td>{element.type}</td> : null}
              {columns.map((column) => (
                <td key={column}>{renderColumnValue(element, column, columns)}</td>
              ))}
            </tr>
          ))}
          {!tableElements.length ? (
            <tr>
              <td colSpan={columns.length + 1 + (showType ? 1 : 0)}>
                {elementStatus || "No elements match the current selection."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" title="System Center Management Pack Catalog - Home">
            <span className="brand-mark">SC</span>
            Home
          </a>
          <nav className="navlinks" aria-label="Reference navigation">
            <a href="/">Catalog</a>
            <a href="/management-pack-selection">Management Pack Selection</a>
            <a href="/sql-server">SQL Server</a>
            <a href="/admin">Admin</a>
            <a href="/api/export">CSV Export</a>
          </nav>
        </div>
      </header>

      <main className="container-fluid">
        <section className="topic-page" aria-labelledby="selection-heading">
          <div className="section-heading">
            <div>
              <h1 id="selection-heading" className="page-title">
                Management Pack Selection
              </h1>
              <p className="lead">
                Select one imported management pack version to view its metadata,
                references, and elements.
              </p>
            </div>
            <div className="selection-controls" aria-label="Management pack selection">
              <label className="version-control">
                Management Pack
                <select
                  aria-label="Choose management pack"
                  disabled={!packChoices.length}
                  value={selectedPackName}
                  onChange={(event) => chooseManagementPack(event.target.value)}
                >
                  {!packChoices.length ? (
                    <option value="">No management packs available</option>
                  ) : null}
                  {packChoices.map((pack) => (
                    <option key={pack.systemName} value={pack.systemName}>
                      {managementPackLabel(pack)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="version-control">
                Management Pack Version
                <select
                  aria-label="Choose management pack version"
                  disabled={!versionChoices.length}
                  value={selectedPack?.version ?? ""}
                  onChange={(event) => chooseVersion(event.target.value)}
                >
                  {!versionChoices.length ? (
                    <option value="">No versions available</option>
                  ) : null}
                  {versionChoices.map((pack) => (
                    <option
                      key={pack.managementPackId}
                      value={pack.version}
                    >
                      {pack.version}
                    </option>
                  ))}
                </select>
              </label>

              <span className="checkbox-control selection-reference-toggle">
                <input
                  checked={showReferences}
                  onChange={(event) => setShowReferences(event.target.checked)}
                  type="checkbox"
                />
                References
              </span>
            </div>
          </div>

          {packStatus && !selectedPack ? (
            <section className="empty-state">{packStatus}</section>
          ) : null}

          {selectedPack ? (
            <>
              <section className="mp-detail" aria-labelledby="selected-pack-heading">
                <div className="mp-card">
                  <div className="mp-header">
                    <div>
                      <h2 id="selected-pack-heading" className="mp-title">
                        {selectedPack.displayName}
                      </h2>
                      <p className="mp-subtitle">
                        {selectedPack.systemName} :: {selectedPack.version}
                      </p>
                    </div>
                    <div className="summary-metrics" aria-label="Selected pack facts">
                      <span>
                        {totalElementsForPack(displayedPack)} elements
                      </span>
                      <span>{packDetail?.references.length ?? 0} references</span>
                      <span>{formatImportedAt(selectedPack.importedAt)}</span>
                    </div>
                  </div>

                  <div className="summary-box">
                    <h3 className="lead">Summary</h3>
                    <p>{selectedPack.description}</p>
                    <dl className="fact-list">
                      <div>
                        <dt>File</dt>
                        <dd>{selectedPack.fileName ?? ""}</dd>
                      </div>
                      {storedSourceFileName && storedSourceFileName !== selectedPack.fileName ? (
                        <div>
                          <dt>Stored Source File</dt>
                          <dd>{storedSourceFileName}</dd>
                        </div>
                      ) : null}
                      {sourceSizeText ? (
                        <div>
                          <dt>Source File Size</dt>
                          <dd>{sourceSizeText}</dd>
                        </div>
                      ) : null}
                      {sourceSha256Text ? (
                        <div>
                          <dt>SHA-256</dt>
                          <dd title={displayedPack?.sourceFileSha256}>
                            {sourceSha256Text}
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Category</dt>
                        <dd>{selectedPack.category}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{selectedPack.sourceKind.toUpperCase()}</dd>
                      </div>
                    </dl>
                    {displayedPack?.r2Key ? (
                      <div className="download-actions" aria-label="Download management pack files">
                        <a
                          className="btn-link btn-primary"
                          href={downloadHref(displayedPack, "xml")}
                        >
                          Download XML
                        </a>
                        {sourceDownloadText ? (
                          <a
                            className="btn-link"
                            href={sourceDownloadHref(displayedPack)}
                          >
                            {sourceDownloadText}
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <p className="download-note minor">
                        No stored source file is available for download for this import.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {showReferences ? (
                <section className="mp-detail" aria-labelledby="references-heading">
                  <div className="section-heading">
                    <h2 id="references-heading">References</h2>
                    <span className="minor">
                      {selectedPack.systemName} :: {selectedPack.version}
                    </span>
                  </div>
                  <div className="ScrollArea">
                    <table className="DataTable">
                      <thead>
                        <tr>
                          <th>Alias</th>
                          <th>ID</th>
                          <th>Version</th>
                          <th>Public Key Token</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(packDetail?.references ?? []).map((reference) => (
                          <tr key={`${reference.alias}-${reference.id}`}>
                            <td>{reference.alias}</td>
                            <td>{reference.id}</td>
                            <td>{reference.version}</td>
                            <td>{reference.publicKeyToken ?? ""}</td>
                          </tr>
                        ))}
                        {packDetail && !packDetail.references.length ? (
                          <tr>
                            <td colSpan={4}>No references are stored for this version.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="mp-detail" aria-labelledby="elements-heading">
                <div className="section-heading">
                  <h2 id="elements-heading">Management Pack Elements</h2>
                  <label className="element-search">
                    <span>Search Elements</span>
                    <input
                      aria-label="Search elements in selected version"
                      value={elementSearch}
                      onChange={(event) => setElementSearch(event.target.value)}
                      placeholder="Filter selected version"
                    />
                  </label>
                </div>

                <div className="section-heading element-summary-heading">
                  <h3>
                    Elements{" "}
                    <span className="lighter">
                      ({elements.length}
                      {totalDisplayedElementCount > elements.length && !elementSearch
                        ? ` of ${totalDisplayedElementCount}`
                        : ""}
                      )
                    </span>
                  </h3>
                  {elementStatus ? <span className="minor">{elementStatus}</span> : null}
                </div>

                {elementGroups.length ? (
                  <>
                    <fieldset className="element-section-toggle-panel">
                      <legend>Element Sections</legend>
                      <div className="element-section-toggle-grid">
                        {elementGroups.map((group) => (
                          <label className="element-section-toggle" key={group.key}>
                            <input
                              checked={elementGroupVisibility[group.key] ?? true}
                              onChange={(event) =>
                                setElementGroupShown(group.key, event.target.checked)
                              }
                              type="checkbox"
                            />
                            <span>{group.title}</span>
                            <strong>{elementCountForGroup(group)}</strong>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {visibleElementGroups.length ? (
                      <div className="element-groups">
                        {visibleElementGroups.map((group) => (
                          <section
                            className="element-group"
                            key={group.key}
                            aria-labelledby={`${group.key}-elements-heading`}
                          >
                            <h4
                              id={`${group.key}-elements-heading`}
                              className="element-group-heading"
                            >
                              {group.title}{" "}
                              <span className="lighter">
                                ({elementCountForGroup(group)})
                              </span>
                            </h4>
                            <div className="ScrollArea">
                              {renderElementTable(
                                group.elements,
                                group.columns,
                                group.showType ?? false
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        All matching element sections are hidden. Select one or
                        more element section checkboxes to show their tables.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-state">
                    {elementStatus || "No elements match the current selection."}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </section>
      </main>

      <footer className="footer" role="contentinfo">
        Private System Center Management Pack reference library
      </footer>
    </>
  );
}
