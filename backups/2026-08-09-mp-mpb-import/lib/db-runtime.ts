import { env } from "cloudflare:workers";
import type { ManagementPackSummary, MpElement, MpReference } from "@/lib/reference-data";

type RuntimeEnv = {
  DB?: D1Database;
  MP_FILES?: R2Bucket;
};

type DbPack = {
  system_name: string;
  display_name: string;
  version: string;
  category: string;
  description: string;
  file_name: string | null;
  source_kind: "seed" | "xml" | "compiled";
  section_counts: string;
};

type DbElement = {
  id: string;
  mp_system_name: string;
  section_key: string;
  element_type: string;
  display_name: string;
  target: string | null;
  category: string | null;
  enabled: string | null;
  alert_generate: string | null;
  accessibility: string | null;
  detail: string | null;
};

type DbReference = {
  mp_system_name: string;
  alias: string;
  reference_id: string;
  version: string;
  public_key_token: string | null;
};

export function getRuntimeEnv() {
  return env as unknown as RuntimeEnv;
}

export async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS management_packs (
      system_name TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      version TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      file_name TEXT,
      source_kind TEXT NOT NULL,
      section_counts TEXT NOT NULL DEFAULT '{}',
      r2_key TEXT,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mp_system_name TEXT NOT NULL,
      alias TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '',
      public_key_token TEXT,
      FOREIGN KEY (mp_system_name) REFERENCES management_packs(system_name)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_elements (
      id TEXT PRIMARY KEY,
      mp_system_name TEXT NOT NULL,
      section_key TEXT NOT NULL,
      element_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      target TEXT,
      category TEXT,
      enabled TEXT,
      alert_generate TEXT,
      accessibility TEXT,
      detail TEXT,
      searchable_text TEXT NOT NULL,
      FOREIGN KEY (mp_system_name) REFERENCES management_packs(system_name)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      r2_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_elements_pack_idx ON mp_elements (mp_system_name)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_elements_section_idx ON mp_elements (section_key)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_elements_search_idx ON mp_elements (searchable_text)"),
  ]);
}

function stringifyCounts(pack: ManagementPackSummary) {
  return JSON.stringify(pack.sectionCounts ?? {});
}

function searchableText(element: MpElement) {
  return [
    element.displayName,
    element.id,
    element.type,
    element.target,
    element.category,
    element.enabled,
    element.alertGenerate,
    element.accessibility,
    element.detail,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export async function saveImportedPack(
  db: D1Database,
  pack: ManagementPackSummary,
  r2Key: string | null
) {
  await ensureSchema(db);
  await db
    .prepare(`INSERT INTO management_packs (
      system_name, display_name, version, category, description, file_name,
      source_kind, section_counts, r2_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(system_name) DO UPDATE SET
      display_name = excluded.display_name,
      version = excluded.version,
      category = excluded.category,
      description = excluded.description,
      file_name = excluded.file_name,
      source_kind = excluded.source_kind,
      section_counts = excluded.section_counts,
      r2_key = excluded.r2_key,
      imported_at = CURRENT_TIMESTAMP`)
    .bind(
      pack.systemName,
      pack.displayName,
      pack.version,
      pack.category,
      pack.description,
      pack.fileName ?? null,
      pack.sourceKind,
      stringifyCounts(pack),
      r2Key
    )
    .run();

  await db.batch([
    db.prepare("DELETE FROM mp_references WHERE mp_system_name = ?").bind(pack.systemName),
    db.prepare("DELETE FROM mp_elements WHERE mp_system_name = ?").bind(pack.systemName),
  ]);

  if (pack.references.length) {
    await db.batch(
      pack.references.map((reference) =>
        db
          .prepare(`INSERT INTO mp_references (
            mp_system_name, alias, reference_id, version, public_key_token
          ) VALUES (?, ?, ?, ?, ?)`)
          .bind(
            pack.systemName,
            reference.alias,
            reference.id,
            reference.version,
            reference.publicKeyToken ?? null
          )
      )
    );
  }

  if (pack.elements.length) {
    await db.batch(
      pack.elements.map((element) =>
        db
          .prepare(`INSERT INTO mp_elements (
            id, mp_system_name, section_key, element_type, display_name,
            target, category, enabled, alert_generate, accessibility, detail,
            searchable_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            `${pack.systemName}:${element.type}:${element.id}`,
            pack.systemName,
            element.section,
            element.type,
            element.displayName,
            element.target ?? null,
            element.category ?? null,
            element.enabled ?? null,
            element.alertGenerate ?? null,
            element.accessibility ?? null,
            element.detail ?? null,
            searchableText(element)
          )
      )
    );
  }
}

export async function recordImportJob(
  db: D1Database,
  job: {
    id: string;
    fileName: string;
    fileType: string;
    status: string;
    message: string;
    r2Key: string | null;
  }
) {
  await ensureSchema(db);
  await db
    .prepare(`INSERT INTO import_jobs (
      id, file_name, file_type, status, message, r2_key
    ) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(job.id, job.fileName, job.fileType, job.status, job.message, job.r2Key)
    .run();
}

export async function readImportedPacks(db: D1Database) {
  await ensureSchema(db);
  const packResult = await db
    .prepare("SELECT * FROM management_packs ORDER BY imported_at DESC")
    .all();
  const packs = (packResult.results ?? []) as unknown as DbPack[];

  if (!packs.length) {
    return [];
  }

  const elementResult = await db
    .prepare("SELECT * FROM mp_elements ORDER BY section_key, display_name")
    .all();
  const referenceResult = await db
    .prepare("SELECT * FROM mp_references ORDER BY alias")
    .all();

  const elements = (elementResult.results ?? []) as unknown as DbElement[];
  const references = (referenceResult.results ?? []) as unknown as DbReference[];

  return packs.map<ManagementPackSummary>((pack) => ({
    systemName: pack.system_name,
    displayName: pack.display_name,
    version: pack.version,
    category: pack.category,
    description: pack.description,
    fileName: pack.file_name ?? undefined,
    sourceKind: pack.source_kind,
    sectionCounts: JSON.parse(pack.section_counts || "{}") as Record<string, number>,
    references: references
      .filter((reference) => reference.mp_system_name === pack.system_name)
      .map<MpReference>((reference) => ({
        alias: reference.alias,
        id: reference.reference_id,
        version: reference.version,
        publicKeyToken: reference.public_key_token ?? undefined,
      })),
    elements: elements
      .filter((element) => element.mp_system_name === pack.system_name)
      .map<MpElement>((element) => ({
        id: element.id.replace(`${pack.system_name}:${element.element_type}:`, ""),
        section: element.section_key,
        type: element.element_type,
        displayName: element.display_name,
        target: element.target ?? undefined,
        category: element.category ?? undefined,
        enabled: element.enabled ?? undefined,
        alertGenerate: element.alert_generate ?? undefined,
        accessibility: element.accessibility ?? undefined,
        detail: element.detail ?? undefined,
      })),
  }));
}
