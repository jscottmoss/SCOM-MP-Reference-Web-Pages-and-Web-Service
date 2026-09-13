import {
  emptyCounts,
  findSectionByType,
  type ManagementPackSummary,
  type MpElement,
  type MpReference,
} from "@/lib/reference-data";

const elementTypeTags = [
  "ClassType",
  "RelationshipType",
  "ConditionDetectionModuleType",
  "DataSourceModuleType",
  "ProbeActionModuleType",
  "WriteActionModuleType",
  "UnitMonitorType",
  "AggregateMonitorType",
  "Discovery",
  "Rule",
  "Task",
  "ConsoleTask",
  "AggregateMonitor",
  "DependencyMonitor",
  "UnitMonitor",
  "Diagnostic",
  "Recovery",
  "Folder",
  "FolderItem",
  "View",
  "StringResource",
  "DataWarehouseScript",
  "LinkedReport",
  "Report",
  "ReportResource",
  "DisplayString",
  "KnowledgeArticle",
];

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function readTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function readAttributes(attributeText: string) {
  const attributes: Record<string, string> = {};
  const regex = /([A-Za-z0-9_:.~-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(attributeText)) !== null) {
    attributes[match[1]] = decodeXml(match[2]);
  }

  return attributes;
}

function readDisplayNames(xml: string) {
  const displayNames = new Map<string, string>();
  const regex = /<DisplayString\b([^>]*)>([\s\S]*?)<\/DisplayString>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const attributes = readAttributes(match[1]);
    const elementId = attributes.ElementID;
    const name = readTag(match[2], "Name");

    if (elementId && name) {
      const key = attributes.SubElementID
        ? `${elementId}:${attributes.SubElementID}`
        : elementId;
      displayNames.set(key, name);
    }
  }

  return displayNames;
}

function readReferences(xml: string) {
  const references: MpReference[] = [];
  const regex = /<Reference\b([^>]*)>([\s\S]*?)<\/Reference>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const attributes = readAttributes(match[1]);
    const id = readTag(match[2], "ID");

    if (!id) {
      continue;
    }

    references.push({
      alias: attributes.Alias || id,
      id,
      version: readTag(match[2], "Version"),
      publicKeyToken: readTag(match[2], "PublicKeyToken") || undefined,
    });
  }

  return references;
}

function collectElements(xml: string, displayNames: Map<string, string>) {
  const elements: MpElement[] = [];
  const seen = new Set<string>();
  const regex = new RegExp(`<(${elementTypeTags.join("|")})\\b([^>]*)>`, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const type = match[1];
    const attributes = readAttributes(match[2]);
    const id = attributes.ID || attributes.ElementID;
    const section = findSectionByType(type)?.key;

    if (!id || !section) {
      continue;
    }

    const elementKey = `${type}:${id}`;

    if (seen.has(elementKey)) {
      continue;
    }

    seen.add(elementKey);

    elements.push({
      id,
      section,
      type,
      displayName: displayNames.get(id) || id,
      target: attributes.Target || attributes.Base || attributes.RelationshipType || undefined,
      category: attributes.Category || undefined,
      enabled: attributes.Enabled || undefined,
      alertGenerate: attributes.AlertGenerate || attributes.GenerateAlert || undefined,
      accessibility: attributes.Accessibility || undefined,
    });
  }

  return elements;
}

export function parseManagementPackXml(
  xml: string,
  fileName: string
): ManagementPackSummary {
  const identityBlock = xml.match(/<Identity>([\s\S]*?)<\/Identity>/i)?.[1] ?? "";
  const displayNames = readDisplayNames(xml);
  const systemName = readTag(identityBlock, "ID") || fileName.replace(/\.[^.]+$/, "");
  const version = readTag(identityBlock, "Version") || "0.0.0.0";
  const references = readReferences(xml);
  const elements = collectElements(xml, displayNames);
  const counts = emptyCounts();

  for (const reference of references) {
    counts.references = (counts.references ?? 0) + 1;
  }

  for (const element of elements) {
    counts[element.section] = (counts[element.section] ?? 0) + 1;
  }

  return {
    systemName,
    displayName: displayNames.get(systemName) || systemName,
    version,
    category: "Imported",
    sourceKind: "xml",
    fileName,
    description: `Imported from ${fileName}.`,
    references,
    sectionCounts: counts,
    elements,
  };
}

export function createCompiledPackPlaceholder(
  fileName: string
): ManagementPackSummary {
  const systemName = fileName.replace(/\.(mp|mpb)$/i, "");

  return {
    systemName,
    displayName: systemName,
    version: "0.0.0.0",
    category: "Imported",
    sourceKind: "compiled",
    fileName,
    description:
      "Compiled management pack package was stored. XML extraction can be added behind this import step when a local MP/MPB reader is available.",
    references: [],
    sectionCounts: emptyCounts(),
    elements: [],
  };
}
