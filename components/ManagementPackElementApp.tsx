"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

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

type ElementDetailProps = {
  initialManagementPack?: string;
  initialVersion?: string;
  initialId?: string;
  initialType?: string;
};

type PropertyRow = {
  label: string;
  value: string;
};

type DetailSection = {
  key: string;
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
};

const detailObjectSectionsToSkip = new Set([
  "attributes",
  "override",
  "relationship",
  "resource",
]);

const attributeKeysShownAsCoreProperties = new Set(
  [
    "id",
    "context",
    "target",
    "source",
    "discovery",
    "monitor",
    "rule",
    "diagnostic",
    "recovery",
    "runas",
    "accessibility",
    "enabled",
    "base",
    "category",
    "parent",
    "property",
    "parameter",
    "value",
    "enforced",
  ].map((key) => key.toLowerCase())
);

const sectionTitleByKey: Record<string, string> = {
  alertSettings: "Alert Settings",
  configurationOverrides: "Configuration Overrides",
  discoveryTypes: "Discovery Types",
  generatedAlert: "Generated Alert",
  memberModules: "Member Modules",
  monitorTypeStates: "Monitor Type States",
  overrideableParameters: "Overrideable Parameters",
  regularDetections: "Regular Detections",
  workflowModules: "Member Modules",
};

const labelByKey: Record<string, string> = {
  id: "ID",
  elementId: "Element ID",
  elementID: "Element ID",
  fileName: "File Name",
  hasNullStream: "Has Null Stream",
  monitorTypeStateId: "Monitor Type State ID",
  monitorTypeStateID: "Monitor Type State ID",
  parameterType: "Parameter Type",
  publicKeyToken: "Public Key Token",
  qualifiedName: "Qualified Name",
  rawXml: "Source XML",
  runAs: "RunAs",
  typeId: "Type ID",
  typeID: "Type ID",
};

const preferredColumnOrder = [
  "id",
  "name",
  "role",
  "typeId",
  "typeID",
  "monitorTypeStateId",
  "monitorTypeStateID",
  "selector",
  "parameterType",
  "source",
  "target",
  "property",
  "parameter",
  "value",
  "enabled",
  "enforced",
  "order",
];

const overrideableParameterColumns = [
  "id",
  "parameterType",
  "selector",
  "displayName",
  "description",
];

const columnLabelsBySection: Record<string, Record<string, string>> = {
  overrideableParameters: {
    id: "ID",
    parameterType: "ParameterType",
    selector: "Selector",
    displayName: "Display Name",
    description: "Description",
  },
};

function detailRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isScalar(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    const lower = value.toLowerCase();

    if (lower === "true") {
      return "True";
    }

    if (lower === "false") {
      return "False";
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(formatValue).filter(Boolean).join(", ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function hasDisplayValue(value: unknown) {
  return formatValue(value).trim().length > 0;
}

function labelForKey(key: string) {
  if (labelByKey[key]) {
    return labelByKey[key];
  }

  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\bId\b/g, "ID")
    .replace(/\bXml\b/g, "XML")
    .replace(/\bSql\b/g, "SQL");

  return spaced
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.toUpperCase() === word ? word : word.slice(0, 1).toUpperCase() + word.slice(1)))
    .join(" ");
}

function sectionTitle(key: string) {
  return sectionTitleByKey[key] ?? labelForKey(key);
}

function valueFromRecord(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (hasDisplayValue(record[key])) {
      return record[key];
    }

    const matched = Object.entries(record).find(
      ([recordKey]) => recordKey.toLowerCase() === key.toLowerCase()
    );

    if (matched && hasDisplayValue(matched[1])) {
      return matched[1];
    }
  }

  return "";
}

function overrideTargetValue(override: Record<string, unknown>, attributes: Record<string, unknown>) {
  return (
    valueFromRecord(
      override,
      "target",
      "discovery",
      "monitor",
      "rule",
      "diagnostic",
      "recovery",
      "secureReference"
    ) ||
    valueFromRecord(
      attributes,
      "Target",
      "Discovery",
      "Monitor",
      "Rule",
      "Diagnostic",
      "Recovery"
    )
  );
}

function buildPropertyRows(element: ServiceElement): PropertyRow[] {
  const attributes = detailRecord(element.detail.attributes);
  const override = detailRecord(element.detail.override);
  const relationship = detailRecord(element.detail.relationship);
  const resource = detailRecord(element.detail.resource);
  const rows: PropertyRow[] = [];
  const seenLabels = new Set<string>();

  function add(label: string, value: unknown) {
    const text = formatValue(value).trim();

    if (!text || seenLabels.has(label.toLowerCase())) {
      return;
    }

    seenLabels.add(label.toLowerCase());
    rows.push({ label, value: text });
  }

  add("Management Pack", element.systemName);
  add("Version", element.version);
  add("Element Type", element.type);
  add("ID", element.id);
  add("Display Name", element.displayName);
  add("Description", element.description);
  add("Context", valueFromRecord(override, "context") || valueFromRecord(attributes, "Context"));
  add(
    "Target",
    overrideTargetValue(override, attributes) ||
      element.target ||
      valueFromRecord(relationship, "targetType", "targetId")
  );
  add("Source", valueFromRecord(relationship, "sourceType", "sourceId"));
  add("RunAs", valueFromRecord(attributes, "RunAs"));
  add("Accessibility", element.accessibility || valueFromRecord(attributes, "Accessibility"));
  add("Enabled", element.enabled || valueFromRecord(attributes, "Enabled"));
  add("Base", element.base || valueFromRecord(attributes, "Base"));
  add("Category", element.category || valueFromRecord(attributes, "Category"));
  add("Parent", element.parent || valueFromRecord(attributes, "Parent"));
  add("Property", valueFromRecord(override, "property") || valueFromRecord(attributes, "Property"));
  add("Parameter", valueFromRecord(override, "parameter") || valueFromRecord(attributes, "Parameter"));
  add("Value", valueFromRecord(override, "value") || valueFromRecord(attributes, "Value"));
  add("Enforced", valueFromRecord(override, "enforced") || valueFromRecord(attributes, "Enforced"));

  for (const [key, value] of Object.entries(attributes)) {
    if (!attributeKeysShownAsCoreProperties.has(key.toLowerCase())) {
      add(labelForKey(key), value);
    }
  }

  for (const [key, value] of Object.entries(resource)) {
    add(labelForKey(key), value);
  }

  for (const [key, value] of Object.entries(element.detail)) {
    if (isScalar(value) && key !== "rawXml") {
      add(labelForKey(key), value);
    }
  }

  return rows;
}

function xmlAttribute(rawXml: unknown, attribute: string) {
  if (typeof rawXml !== "string") {
    return "";
  }

  const expression = new RegExp(`\\b${attribute}=["']([^"']+)["']`, "i");
  return rawXml.match(expression)?.[1] ?? "";
}

function normalizeDetailRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...row };
  const typeId = xmlAttribute(row.rawXml, "TypeID");
  const monitorTypeStateId = xmlAttribute(row.rawXml, "MonitorTypeStateID");

  if (typeId && !hasDisplayValue(normalized.typeId) && !hasDisplayValue(normalized.typeID)) {
    normalized.typeId = typeId;
  }

  if (
    monitorTypeStateId &&
    !hasDisplayValue(normalized.monitorTypeStateId) &&
    !hasDisplayValue(normalized.monitorTypeStateID)
  ) {
    normalized.monitorTypeStateId = monitorTypeStateId;
  }

  return normalized;
}

function rowsFromDetailValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? normalizeDetailRow(item as Record<string, unknown>)
          : { value: item }
      )
      .filter((row) => Object.values(row).some(hasDisplayValue));
  }

  if (value && typeof value === "object") {
    const record = normalizeDetailRow(value as Record<string, unknown>);
    return Object.values(record).some(hasDisplayValue) ? [record] : [];
  }

  return [];
}

function tableColumns(rows: Record<string, unknown>[]) {
  const available = new Set(
    rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key, value]) => key !== "rawXml" && hasDisplayValue(value))
        .map(([key]) => key)
    )
  );
  const columns = preferredColumnOrder.filter((column) => available.has(column));

  for (const column of available) {
    if (!columns.includes(column)) {
      columns.push(column);
    }
  }

  return columns;
}

function columnsForDetailSection(key: string, rows: Record<string, unknown>[]) {
  if (key === "overrideableParameters") {
    return overrideableParameterColumns;
  }

  return tableColumns(rows);
}

function buildDetailSections(element: ServiceElement): DetailSection[] {
  return Object.entries(element.detail)
    .filter(([key]) => !detailObjectSectionsToSkip.has(key))
    .map(([key, value]) => {
      const rows = rowsFromDetailValue(value);
      const columns = columnsForDetailSection(key, rows);

      return {
        key,
        title: sectionTitle(key),
        rows,
        columns,
      };
    })
    .filter((section) => section.rows.length > 0 && section.columns.length > 0);
}

function labelForSectionColumn(sectionKey: string, column: string) {
  return columnLabelsBySection[sectionKey]?.[column] ?? labelForKey(column);
}

function renderXmlAttributes(attributeText: string, tokenKey: string) {
  const nodes: ReactNode[] = [];
  const attributePattern = /(\s+)([^\s=/>]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s/>]+)?/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = attributePattern.exec(attributeText))) {
    if (match.index > cursor) {
      nodes.push(attributeText.slice(cursor, match.index));
    }

    nodes.push(match[1]);
    nodes.push(
      <span className="hljs-attribute" key={`${tokenKey}-attr-${index}`}>
        {match[2]}
      </span>
    );
    nodes.push(match[3]);

    if (match[4]) {
      nodes.push(
        <span className="hljs-value" key={`${tokenKey}-value-${index}`}>
          {match[4]}
        </span>
      );
    }

    cursor = match.index + match[0].length;
    index += 1;
  }

  if (cursor < attributeText.length) {
    nodes.push(attributeText.slice(cursor));
  }

  return nodes;
}

function renderXmlTag(tag: string, tokenKey: string) {
  const tagMatch = tag.match(/^<(\/?)([^\s/>]+)([\s\S]*?)(\/?)>$/);

  if (!tagMatch) {
    return (
      <span className="hljs-tag" key={tokenKey}>
        {tag}
      </span>
    );
  }

  const [, closingSlash, tagName, attributeText, selfClosingSlash] = tagMatch;

  return (
    <span className="hljs-tag" key={tokenKey}>
      &lt;
      {closingSlash}
      <span className="hljs-title">{tagName}</span>
      {renderXmlAttributes(attributeText, tokenKey)}
      {selfClosingSlash}
      &gt;
    </span>
  );
}

function renderHighlightedXml(source: string) {
  const nodes: ReactNode[] = [];
  const xmlTokenPattern =
    /(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/?[A-Za-z_][\w:.-]*(?:\s+[^<>]*?)?\/?>)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = xmlTokenPattern.exec(source))) {
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `xml-token-${tokenIndex}`;

    if (token.startsWith("<!--")) {
      nodes.push(
        <span className="hljs-comment" key={key}>
          {token}
        </span>
      );
    } else if (token.startsWith("<?")) {
      nodes.push(
        <span className="hljs-pi" key={key}>
          {token}
        </span>
      );
    } else if (token.startsWith("<!")) {
      nodes.push(
        <span className="hljs-doctype" key={key}>
          {token}
        </span>
      );
    } else {
      nodes.push(renderXmlTag(token, key));
    }

    cursor = match.index + token.length;
    tokenIndex += 1;
  }

  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }

  return nodes;
}

function selectionHref(element?: ServiceElement | null, props?: ElementDetailProps) {
  const managementPack = element?.systemName ?? props?.initialManagementPack;
  const version = element?.version ?? props?.initialVersion;
  const params = new URLSearchParams();

  if (managementPack) {
    params.set("managementPack", managementPack);
  }

  if (version) {
    params.set("version", version);
  }

  const query = params.toString();
  return query ? `/management-pack-selection?${query}` : "/management-pack-selection";
}

async function fetchElement(props: ElementDetailProps) {
  if (!props.initialId) {
    throw new Error("No element ID was provided.");
  }

  const params = new URLSearchParams({ id: props.initialId });

  if (props.initialManagementPack) {
    params.set("managementPack", props.initialManagementPack);
  }

  if (props.initialVersion) {
    params.set("version", props.initialVersion);
  }

  if (props.initialType) {
    params.set("type", props.initialType);
  }

  const response = await fetch(`/api/mp/element?${params.toString()}`);
  const payload = (await response.json()) as {
    element?: ServiceElement;
    error?: string;
    message?: string;
  };

  if (!response.ok || !payload.element) {
    throw new Error(payload.error ?? payload.message ?? "The element could not be loaded.");
  }

  return payload.element;
}

export function ManagementPackElementApp(props: ElementDetailProps) {
  const [element, setElement] = useState<ServiceElement | null>(null);
  const [status, setStatus] = useState("Loading element details...");

  useEffect(() => {
    let active = true;
    setElement(null);
    setStatus("Loading element details...");

    fetchElement(props)
      .then((nextElement) => {
        if (!active) {
          return;
        }

        setElement(nextElement);
        setStatus("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setStatus(error instanceof Error ? error.message : "The element could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [props.initialId, props.initialManagementPack, props.initialType, props.initialVersion]);

  const propertyRows = useMemo(() => (element ? buildPropertyRows(element) : []), [element]);
  const detailSections = useMemo(() => (element ? buildDetailSections(element) : []), [element]);
  const backHref = selectionHref(element, props);

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
        <section className="topic-page element-detail-page" aria-labelledby="element-heading">
          <p className="element-detail-actions">
            <a className="btn-link" href={backHref}>
              Back to Management Pack Selection
            </a>
          </p>

          <h1 id="element-heading" className="page-title">
            {element?.displayName ?? "Management Pack Element"}
          </h1>
          <h2 className="lead">
            {element ? `${element.id} (${element.type})` : status}
          </h2>

          {element?.description ? (
            <p className="element-detail-description">{element.description}</p>
          ) : null}

          {status && !element ? <section className="empty-state">{status}</section> : null}

          {element ? (
            <>
              <section className="mp-detail" aria-labelledby="element-properties-heading">
                <h3 id="element-properties-heading">Element properties:</h3>
                <div className="ScrollArea">
                  <table className="DataTable element-properties-table">
                    <tbody>
                      {propertyRows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {detailSections.map((section) => (
                <section className="mp-detail" key={section.key} aria-labelledby={`${section.key}-heading`}>
                  <h3 id={`${section.key}-heading`}>{section.title}:</h3>
                  <div className="ScrollArea">
                    <table className="DataTable detail-section-table">
                      <thead>
                        <tr>
                          {section.columns.map((column) => (
                            <th key={column}>{labelForSectionColumn(section.key, column)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, rowIndex) => (
                          <tr key={`${section.key}-${rowIndex}`}>
                            {section.columns.map((column) => (
                              <td key={column}>{formatValue(row[column])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              <section className="mp-detail" aria-labelledby="source-code-heading">
                <h3 id="source-code-heading">Source Code:</h3>
                <pre className="CodeArea xml hljs"><code>{renderHighlightedXml(element.rawXml ?? "Raw XML was not stored for this element.")}</code></pre>
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
