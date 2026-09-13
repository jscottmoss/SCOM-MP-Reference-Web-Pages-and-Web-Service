import type { ManagementPackSummary, MpElement } from "@/lib/reference-data";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsForPack(pack: ManagementPackSummary, section?: string) {
  const rows: Array<Record<string, string>> = [];

  if (!section || section === "references") {
    for (const reference of pack.references) {
      rows.push({
        managementPack: pack.systemName,
        section: "references",
        type: "Reference",
        displayName: reference.alias,
        id: reference.id,
        target: "",
        category: "",
        enabled: "",
        alertGenerate: "",
        accessibility: "",
        version: reference.version,
      });
    }
  }

  for (const element of pack.elements) {
    if (section && element.section !== section) {
      continue;
    }

    rows.push(elementToRow(pack, element));
  }

  return rows;
}

function elementToRow(pack: ManagementPackSummary, element: MpElement) {
  return {
    managementPack: pack.systemName,
    section: element.section,
    type: element.type,
    displayName: element.displayName,
    id: element.id,
    target: element.target ?? "",
    category: element.category ?? "",
    enabled: element.enabled ?? "",
    alertGenerate: element.alertGenerate ?? "",
    accessibility: element.accessibility ?? "",
    version: pack.version,
  };
}

export function packsToCsv(packs: ManagementPackSummary[], options: { pack?: string; section?: string }) {
  const headers = [
    "managementPack",
    "version",
    "section",
    "type",
    "displayName",
    "id",
    "target",
    "category",
    "enabled",
    "alertGenerate",
    "accessibility",
  ];

  const source = options.pack
    ? packs.filter((pack) => pack.systemName === options.pack)
    : packs;
  const rows = source.flatMap((pack) => rowsForPack(pack, options.section));

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n");
}
