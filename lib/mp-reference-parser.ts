import { emptyCounts, findSectionByType } from "@/lib/reference-data";

export type ReferenceElement = {
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
  rawXml: string;
  searchableText: string;
};

export type ReferencePack = {
  systemName: string;
  displayName: string;
  version: string;
  category: string;
  description: string;
  fileName: string;
  sourceKind: "xml" | "compiled";
  references: {
    alias: string;
    id: string;
    version: string;
    publicKeyToken?: string;
    rawXml: string;
  }[];
  sectionCounts: Record<string, number>;
  elementTypeCounts: Record<string, number>;
  elements: ReferenceElement[];
};

type XmlBlock = {
  tag: string;
  attributes: Record<string, string>;
  inner: string;
  raw: string;
  index: number;
};

const groupedTypes: Record<string, { section: string; group: string }> = {
  ClassType: { section: "classes-relationships", group: "EntityTypes" },
  RelationshipType: { section: "classes-relationships", group: "EntityTypes" },
  SchemaType: { section: "data-sources", group: "TypeDefinitions" },
  SecureReference: { section: "data-sources", group: "TypeDefinitions" },
  ConditionDetectionModuleType: { section: "data-sources", group: "ModuleTypes" },
  DataSourceModuleType: { section: "data-sources", group: "ModuleTypes" },
  ProbeActionModuleType: { section: "data-sources", group: "ModuleTypes" },
  WriteActionModuleType: { section: "data-sources", group: "ModuleTypes" },
  UnitMonitorType: { section: "monitor-types", group: "MonitorTypes" },
  AggregateMonitorType: { section: "monitor-types", group: "MonitorTypes" },
  Discovery: { section: "discoveries", group: "Monitoring" },
  Rule: { section: "rules", group: "Monitoring" },
  AggregateMonitor: { section: "monitors", group: "Monitors" },
  DependencyMonitor: { section: "monitors", group: "Monitors" },
  UnitMonitor: { section: "monitors", group: "Monitors" },
  Task: { section: "tasks", group: "Tasks" },
  ConsoleTask: { section: "tasks", group: "Presentation" },
  Diagnostic: { section: "diagnostics-recoveries", group: "Diagnostics" },
  Recovery: { section: "diagnostics-recoveries", group: "Recoveries" },
  DiscoveryConfigurationOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  DiscoveryPropertyOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  DiagnosticConfigurationOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  DiagnosticPropertyOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  MonitorConfigurationOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  MonitorPropertyOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  RecoveryConfigurationOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  RecoveryPropertyOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  RuleConfigurationOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  RulePropertyOverride: { section: "diagnostics-recoveries", group: "Overrides" },
  Category: { section: "diagnostics-recoveries", group: "Categories" },
  Folder: { section: "views", group: "Presentation" },
  FolderItem: { section: "views", group: "Presentation" },
  View: { section: "views", group: "Presentation" },
  StringResource: { section: "string-resources", group: "Presentation" },
  ImageReference: { section: "string-resources", group: "Presentation" },
  ComponentType: { section: "views", group: "AdvancedPresentation" },
  ComponentImplementation: { section: "views", group: "AdvancedPresentation" },
  ComponentReference: { section: "views", group: "AdvancedPresentation" },
  ComponentBehavior: { section: "views", group: "AdvancedPresentation" },
  Resource: { section: "reports", group: "Resources" },
  Assembly: { section: "reports", group: "Resources" },
  DeployableAssembly: { section: "reports", group: "Resources" },
  Image: { section: "reports", group: "Resources" },
  DataWarehouseScript: { section: "reports", group: "Reports" },
  LinkedReport: { section: "reports", group: "Reports" },
  Report: { section: "reports", group: "Reports" },
  ReportResource: { section: "reports", group: "Reports" },
  Template: { section: "views", group: "Templates" },
  UIPage: { section: "views", group: "Templates" },
  UIPageSet: { section: "views", group: "Templates" },
  DisplayString: { section: "display-strings", group: "LanguagePacks" },
  KnowledgeArticle: { section: "knowledge-articles", group: "LanguagePacks" },
};

const elementTypeTags = Object.keys(groupedTypes);

const overrideTargetAttributes = [
  "Discovery",
  "Monitor",
  "Rule",
  "Diagnostic",
  "Recovery",
  "Target",
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

function stripXml(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function readAttributes(attributeText: string) {
  const attributes: Record<string, string> = {};
  const regex = /([A-Za-z0-9_:.~-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(attributeText)) !== null) {
    attributes[match[1]] = decodeXml(match[2] ?? match[3] ?? "");
  }

  return attributes;
}

function readTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripXml(match[1]) : "";
}

function readBlocks(xml: string, tag: string): XmlBlock[] {
  const blocks: XmlBlock[] = [];
  const openTag = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  const tagToken = new RegExp(`</?${tag}\\b[^>]*>`, "gi");
  let match: RegExpExecArray | null;

  while ((match = openTag.exec(xml)) !== null) {
    const rawStart = match[0];
    const innerStart = openTag.lastIndex;

    if (/\/\s*>$/.test(rawStart)) {
      blocks.push({
        tag,
        attributes: readAttributes(match[1]),
        inner: "",
        raw: rawStart,
        index: match.index,
      });
      continue;
    }

    tagToken.lastIndex = innerStart;
    let depth = 1;
    let closeMatch: RegExpExecArray | null = null;

    while ((closeMatch = tagToken.exec(xml)) !== null) {
      const token = closeMatch[0];

      if (/^<\//.test(token)) {
        depth -= 1;

        if (depth === 0) {
          break;
        }
      } else if (!/\/\s*>$/.test(token)) {
        depth += 1;
      }
    }

    if (!closeMatch || depth !== 0) {
      continue;
    }

    const innerEnd = closeMatch.index;
    const rawEnd = tagToken.lastIndex;

    blocks.push({
      tag,
      attributes: readAttributes(match[1]),
      inner: xml.slice(innerStart, innerEnd),
      raw: xml.slice(match.index, rawEnd),
      index: match.index,
    });

    openTag.lastIndex = rawEnd;
  }

  return blocks.sort((a, b) => a.index - b.index);
}

function readFirstChildAttributes(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}\\b([^>]*)\\/?>(?:[\\s\\S]*?<\\/${tag}>)?`, "i"));
  return match ? readAttributes(match[1]) : {};
}

function readChildBlocks(xml: string, tag: string) {
  return readBlocks(xml, tag).map((block) => ({
    id: block.attributes.ID,
    type: block.attributes.TypeID || block.attributes.TypeId || block.attributes.Type,
    rawXml: block.raw,
  }));
}

function boolish(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return /^(true|1|yes)$/i.test(value) ? "True" : /^(false|0|no)$/i.test(value) ? "False" : value;
}

function readDisplayStrings(xml: string) {
  const displayStrings = new Map<string, { name?: string; description?: string }>();

  for (const block of readBlocks(xml, "DisplayString")) {
    const elementId = block.attributes.ElementID;

    if (!elementId) {
      continue;
    }

    const subElementId = block.attributes.SubElementID;
    const key = subElementId ? `${elementId}:${subElementId}` : elementId;
    displayStrings.set(key, {
      name: readTag(block.inner, "Name") || undefined,
      description: readTag(block.inner, "Description") || undefined,
    });
  }

  return displayStrings;
}

function readReferences(xml: string) {
  return readBlocks(xml, "Reference")
    .map((block) => ({
      alias: block.attributes.Alias || readTag(block.inner, "ID"),
      id: readTag(block.inner, "ID"),
      version: readTag(block.inner, "Version"),
      publicKeyToken: readTag(block.inner, "PublicKeyToken") || undefined,
      rawXml: block.raw,
    }))
    .filter((reference) => reference.id);
}

function firstText(...values: (string | undefined)[]) {
  return values.find((value) => value && value.trim()) || undefined;
}

function keyValueRows(entries: [string, string | undefined][]) {
  return entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([name, value]) => ({ name, value }));
}

function overrideTargetForBlock(block: XmlBlock) {
  const attribute = overrideTargetAttributes.find((key) => block.attributes[key]);

  return attribute
    ? {
        attribute,
        value: block.attributes[attribute],
      }
    : {
        attribute: undefined,
        value: undefined,
      };
}

function isOverrideBlock(block: XmlBlock) {
  return /Override$/i.test(block.tag);
}

function elementTargetForBlock(block: XmlBlock) {
  if (isOverrideBlock(block)) {
    return firstText(overrideTargetForBlock(block).value, block.attributes.Context);
  }

  return firstText(block.attributes.Target, block.attributes.Context);
}

function elementBaseForBlock(block: XmlBlock) {
  return firstText(
    block.attributes.Base,
    block.attributes.TypeID,
    block.attributes.TypeId,
    block.attributes.Type
  );
}

function detailForBlock(block: XmlBlock) {
  const a = block.attributes;
  const source = readFirstChildAttributes(block.inner, "Source");
  const target = readFirstChildAttributes(block.inner, "Target");
  const alertSettings = block.inner.match(/<AlertSettings\b[^>]*>([\s\S]*?)<\/AlertSettings>/i)?.[1] ?? "";
  const configuration = block.inner.match(/<Configuration\b[^>]*>([\s\S]*?)<\/Configuration>/i)?.[1] ?? "";
  const detail: Record<string, unknown> = {
    attributes: a,
  };

  if (a.Base) {
    detail.base = a.Base;
  }

  if (source.Type || target.Type) {
    detail.relationship = {
      sourceId: source.ID,
      sourceType: source.Type,
      targetId: target.ID,
      targetType: target.Type,
    };
  }

  const classProperties = readBlocks(block.inner, "Property").map((property, index) => ({
    id: property.attributes.ID,
    type: property.attributes.Type,
    key: boolish(property.attributes.Key),
    maxLength: property.attributes.MaxLength,
    order: index,
  }));

  if (classProperties.length) {
    detail.properties = classProperties;
  }

  const overrideableParameters = readBlocks(block.inner, "OverrideableParameter").map(
    (parameter, index) => ({
      id: parameter.attributes.ID,
      selector: parameter.attributes.Selector,
      parameterType: parameter.attributes.ParameterType,
      order: index,
    })
  );

  if (overrideableParameters.length) {
    detail.overrideableParameters = overrideableParameters;
  }

  const monitorStates = readBlocks(block.inner, "MonitorTypeState").map((state, index) => ({
    id: state.attributes.ID,
    noDetection: boolish(state.attributes.NoDetection),
    order: index,
  }));

  if (monitorStates.length) {
    detail.monitorTypeStates = monitorStates;
  }

  const operationalStates = readBlocks(block.inner, "OperationalState").map((state, index) => ({
    id: state.attributes.ID,
    monitorTypeStateId: state.attributes.MonitorTypeStateID,
    healthState: state.attributes.HealthState,
    order: index,
  }));

  if (operationalStates.length) {
    detail.operationalStates = operationalStates;
  }

  const workflowModules = [
    ...readChildBlocks(block.inner, "DataSource").map((module) => ({
      ...module,
      role: "DataSource",
    })),
    ...readChildBlocks(block.inner, "ConditionDetection").map((module) => ({
      ...module,
      role: "ConditionDetection",
    })),
    ...readChildBlocks(block.inner, "ProbeAction").map((module) => ({
      ...module,
      role: "ProbeAction",
    })),
    ...readChildBlocks(block.inner, "WriteAction").map((module) => ({
      ...module,
      role: "WriteAction",
    })),
  ].filter((module) => module.id || module.type);

  if (workflowModules.length) {
    detail.workflowModules = workflowModules;
  }

  const alertParameters = readBlocks(block.inner, "AlertParameters").flatMap((parameters) =>
    Array.from(parameters.inner.matchAll(/<AlertParameter(\d+)>([\s\S]*?)<\/AlertParameter\1>/gi)).map(
      (match) => ({
        number: Number(match[1]),
        value: stripXml(match[2]),
      })
    )
  );

  if (alertSettings) {
    detail.alertSettings = {
      alertOnState: readTag(alertSettings, "AlertOnState"),
      autoResolve: readTag(alertSettings, "AutoResolve"),
      priority: readTag(alertSettings, "AlertPriority") || readTag(alertSettings, "Priority"),
      severity: readTag(alertSettings, "AlertSeverity") || readTag(alertSettings, "Severity"),
      alertParameters,
    };
  }

  const generatedAlert = block.inner.match(/<WriteAction\b[^>]*TypeID="Health!System\.Health\.GenerateAlert"[\s\S]*?<\/WriteAction>/i)?.[0];
  if (generatedAlert) {
    detail.generatedAlert = {
      priority: readTag(generatedAlert, "Priority"),
      severity: readTag(generatedAlert, "Severity"),
      alertMessageId: readTag(generatedAlert, "AlertMessageId"),
      alertParameters,
    };
  }

  const performanceCounters = readBlocks(block.inner, "ConditionDetection")
    .filter((condition) => /Performance\.DataGenericMapper/i.test(condition.attributes.TypeID ?? ""))
    .map((condition) => ({
      objectName: readTag(condition.inner, "ObjectName"),
      counterName: readTag(condition.inner, "CounterName"),
      instanceName: readTag(condition.inner, "InstanceName"),
      value: readTag(condition.inner, "Value"),
    }));

  if (performanceCounters.length) {
    detail.performanceCounters = performanceCounters;
  }

  const eventDisplayNumbers = readBlocks(block.inner, "EventDisplayNumber")
    .map((event) => stripXml(event.inner))
    .filter(Boolean);

  if (eventDisplayNumbers.length) {
    detail.eventDisplayNumbers = [...new Set(eventDisplayNumbers)];
  }

  if (configuration) {
    detail.configurationText = stripXml(configuration).slice(0, 4000);
  }

  if (isOverrideBlock(block)) {
    const overrideTarget = overrideTargetForBlock(block);
    const value = readTag(block.inner, "Value");
    const enforced = boolish(a.Enforced) || "False";

    detail.override = {
      context: a.Context,
      target: overrideTarget.value,
      targetType: overrideTarget.attribute,
      monitor: a.Monitor,
      rule: a.Rule,
      discovery: a.Discovery,
      diagnostic: a.Diagnostic,
      recovery: a.Recovery,
      property: a.Property,
      parameter: a.Parameter,
      value,
      enforced,
    };
    detail.elementProperties = keyValueRows([
      ["Context", a.Context],
      ["Target", overrideTarget.value],
      ["Target Type", overrideTarget.attribute],
      ["Property", a.Property],
      ["Parameter", a.Parameter],
      ["Value", value],
      ["Enforced", enforced],
    ]);
    detail.sourceCodeKind = block.tag;
  }

  if (block.tag === "Diagnostic" || block.tag === "Recovery") {
    detail.diagnosticRecovery = {
      target: a.Target,
      enabled: boolish(a.Enabled),
      accessibility: a.Accessibility,
      executeOnState: a.ExecuteOnState,
      monitor: a.Monitor,
    };
    detail.elementProperties = keyValueRows([
      ["Target", a.Target],
      ["Monitor", a.Monitor],
      ["Execute On State", a.ExecuteOnState],
      ["Enabled", boolish(a.Enabled)],
      ["Accessibility", a.Accessibility],
    ]);
  }

  if (block.tag === "KnowledgeArticle") {
    detail.knowledge = {
      visible: boolish(a.Visible),
      sectionTitles: Array.from(block.inner.matchAll(/<maml:title[^>]*>([\s\S]*?)<\/maml:title>/gi)).map(
        (match) => stripXml(match[1])
      ),
      firstParagraph:
        block.inner.match(/<maml:para[^>]*>([\s\S]*?)<\/maml:para>/i)?.[1] &&
        stripXml(block.inner.match(/<maml:para[^>]*>([\s\S]*?)<\/maml:para>/i)?.[1] ?? ""),
    };
  }

  if (a.FileName || a.QualifiedName || a.HasNullStream) {
    detail.resource = {
      fileName: a.FileName,
      qualifiedName: a.QualifiedName,
      hasNullStream: boolish(a.HasNullStream),
    };
  }

  return detail;
}

function searchableText(element: Omit<ReferenceElement, "searchableText">) {
  return [
    element.id,
    element.type,
    element.section,
    element.group,
    element.displayName,
    element.description,
    element.target,
    element.base,
    element.accessibility,
    element.enabled,
    element.category,
    JSON.stringify(element.detail),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function elementIdForBlock(type: string, block: XmlBlock) {
  const a = block.attributes;

  if (type === "DisplayString" && a.ElementID) {
    return a.SubElementID ? `${a.ElementID}:${a.SubElementID}` : a.ElementID;
  }

  if (type === "KnowledgeArticle" && a.ElementID) {
    return a.ElementID;
  }

  if (type === "Category" && !a.ID && a.Target) {
    return `${a.Target}:${a.Value || "Category"}`;
  }

  return a.ID || a.ElementID || a.Target;
}

function repeatSafeElementId(
  type: string,
  id: string,
  seenElementKeys: Map<string, number>
) {
  const key = `${type}:${id}`;
  const seenCount = seenElementKeys.get(key) ?? 0;
  seenElementKeys.set(key, seenCount + 1);

  return seenCount ? `${id}#${seenCount + 1}` : id;
}

export function parseManagementPackReferenceXml(
  xml: string,
  fileName: string,
  sourceKind: "xml" | "compiled" = "xml"
): ReferencePack {
  const identityBlock = xml.match(/<Identity>([\s\S]*?)<\/Identity>/i)?.[1] ?? "";
  const displayStrings = readDisplayStrings(xml);
  const systemName = readTag(identityBlock, "ID") || fileName.replace(/\.[^.]+$/, "");
  const version = readTag(identityBlock, "Version") || "0.0.0.0";
  const description =
    displayStrings.get(systemName)?.description || `Imported from ${fileName}.`;
  const elements: ReferenceElement[] = [];
  const sectionCounts = emptyCounts();
  const elementTypeCounts: Record<string, number> = {};
  const seenElementKeys = new Map<string, number>();

  for (const type of elementTypeTags) {
    for (const block of readBlocks(xml, type)) {
      const originalId = elementIdForBlock(type, block);

      if (!originalId) {
        continue;
      }

      const id = repeatSafeElementId(type, originalId, seenElementKeys);
      const group = groupedTypes[type] ?? {
        section: findSectionByType(type)?.key ?? "other",
        group: "Other",
      };
      const localized =
        displayStrings.get(originalId) ??
        displayStrings.get(block.attributes.ID || "") ??
        displayStrings.get(block.attributes.ElementID || "");
      const detail = detailForBlock(block);
      const elementBase = elementBaseForBlock(block);
      const inlineDisplayName = type === "DisplayString" ? readTag(block.inner, "Name") : "";
      const inlineDescription =
        type === "DisplayString" ? readTag(block.inner, "Description") : "";
      const element: Omit<ReferenceElement, "searchableText"> = {
        id,
        type,
        section: group.section,
        group: group.group,
        displayName: inlineDisplayName || localized?.name || originalId,
        description: inlineDescription || localized?.description,
        target: elementTargetForBlock(block),
        base: elementBase || undefined,
        accessibility: block.attributes.Accessibility,
        enabled: boolish(block.attributes.Enabled),
        category: readTag(block.inner, "Category") || block.attributes.Category || block.attributes.Value || undefined,
        parent:
          block.attributes.ParentMonitorID ||
          block.attributes.Parent ||
          block.attributes.ParentFolder ||
          undefined,
        detail,
        rawXml: block.raw,
      };

      elements.push({ ...element, searchableText: searchableText(element) });
      sectionCounts[group.section] = (sectionCounts[group.section] ?? 0) + 1;
      elementTypeCounts[type] = (elementTypeCounts[type] ?? 0) + 1;
    }
  }

  const references = readReferences(xml);

  return {
    systemName,
    displayName: displayStrings.get(systemName)?.name || systemName,
    version,
    category: "Imported",
    description,
    fileName,
    sourceKind,
    references,
    sectionCounts: {
      ...sectionCounts,
      references: references.length,
    },
    elementTypeCounts,
    elements,
  };
}
