import type { ReferenceElement, ReferencePack } from "@/lib/mp-reference-parser";
import type { StoredSourceKind } from "@/lib/source-file-storage";

type ReferencePackRow = {
  management_pack_id: number;
  system_name: string;
  display_name: string;
  version: string;
  category: string;
  description: string;
  source_file_name: string;
  source_kind: "xml" | "compiled";
  section_counts: string;
  element_type_counts: string;
  r2_key: string | null;
  source_file_id: string | null;
  source_original_file_name?: string | null;
  source_file_extension?: string | null;
  source_content_type?: string | null;
  source_file_size?: number | null;
  source_sha256?: string | null;
  source_processing_status?: string | null;
  source_processing_message?: string | null;
  source_extracted_pack_count?: number | null;
  source_uploaded_at?: string | null;
  source_updated_at?: string | null;
  source_r2_key?: string | null;
  imported_at: string;
};

type SourceFileRow = {
  source_file_id: string;
  original_file_name: string;
  file_extension: string;
  source_kind: StoredSourceKind;
  content_type: string;
  file_size: number;
  sha256: string;
  r2_key: string | null;
  processing_status: string;
  processing_message: string;
  extracted_pack_count: number;
  uploaded_at: string;
  updated_at: string;
};

type ReferenceElementRow = {
  element_row_id: number;
  management_pack_id: number;
  system_name: string;
  version: string;
  element_id: string;
  element_type: string;
  section_key: string;
  group_name: string;
  display_name: string;
  description: string | null;
  target: string | null;
  base: string | null;
  accessibility: string | null;
  enabled: string | null;
  category: string | null;
  parent: string | null;
  detail_json: string;
  raw_xml: string;
};

type ReferenceRow = {
  alias: string;
  reference_id: string;
  version: string;
  public_key_token: string | null;
};

type CategoryRow = {
  category_id: number;
  slug: string;
  name: string;
  description: string;
  member_count: number | null;
  created_at: string;
  updated_at: string;
};

type QueryFilters = {
  managementPack?: string;
  version?: string;
  category?: string;
  elementId?: string;
  type?: string;
  section?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type ServicePackSummary = {
  managementPackId: number;
  systemName: string;
  displayName: string;
  version: string;
  category: string;
  description: string;
  fileName: string;
  sourceKind: "xml" | "compiled";
  sectionCounts: Record<string, number>;
  elementTypeCounts: Record<string, number>;
  r2Key?: string;
  sourceFileId?: string;
  sourceFileName?: string;
  sourceFileExtension?: string;
  sourceFileSize?: number;
  sourceFileSha256?: string;
  sourceFileStatus?: string;
  sourceFileMessage?: string;
  sourceFileExtractedPackCount?: number;
  sourceFileUploadedAt?: string;
  importedAt: string;
};

export type SourceFileInput = {
  sourceFileId: string;
  originalFileName: string;
  fileExtension: string;
  sourceKind: StoredSourceKind;
  contentType: string;
  fileSize: number;
  sha256: string;
  r2Key: string | null;
  processingStatus?: string;
  processingMessage?: string;
  extractedPackCount?: number;
};

export type SourceFileRecord = {
  sourceFileId: string;
  originalFileName: string;
  fileExtension: string;
  sourceKind: StoredSourceKind;
  contentType: string;
  fileSize: number;
  sha256: string;
  r2Key?: string;
  processingStatus: string;
  processingMessage: string;
  extractedPackCount: number;
  uploadedAt: string;
  updatedAt: string;
};

export type ReferencePackStorage = {
  r2Key: string | null;
  sourceFileId?: string | null;
};

export type CategorySummary = {
  categoryId: number;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryDetail = CategorySummary & {
  members: ServicePackSummary[];
  latestMembers: ServicePackSummary[];
  sectionCounts: Record<string, number>;
  elementTypeCounts: Record<string, number>;
};

export type ServiceElement = {
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

async function runBatch(db: D1Database, statements: D1PreparedStatement[], size = 50) {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

function jsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sourceFileFromRow(row: SourceFileRow): SourceFileRecord {
  return {
    sourceFileId: row.source_file_id,
    originalFileName: row.original_file_name,
    fileExtension: row.file_extension,
    sourceKind: row.source_kind,
    contentType: row.content_type,
    fileSize: row.file_size,
    sha256: row.sha256,
    r2Key: row.r2_key ?? undefined,
    processingStatus: row.processing_status,
    processingMessage: row.processing_message,
    extractedPackCount: row.extracted_pack_count,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
  };
}

function packFromRow(row: ReferencePackRow): ServicePackSummary {
  return {
    managementPackId: row.management_pack_id,
    systemName: row.system_name,
    displayName: row.display_name,
    version: row.version,
    category: row.category,
    description: row.description,
    fileName: row.source_file_name,
    sourceKind: row.source_kind,
    sectionCounts: jsonParse(row.section_counts, {}),
    elementTypeCounts: jsonParse(row.element_type_counts, {}),
    r2Key: row.r2_key ?? row.source_r2_key ?? undefined,
    sourceFileId: row.source_file_id ?? undefined,
    sourceFileName: row.source_original_file_name ?? undefined,
    sourceFileExtension: row.source_file_extension ?? undefined,
    sourceFileSize: row.source_file_size ?? undefined,
    sourceFileSha256: row.source_sha256 ?? undefined,
    sourceFileStatus: row.source_processing_status ?? undefined,
    sourceFileMessage: row.source_processing_message ?? undefined,
    sourceFileExtractedPackCount: row.source_extracted_pack_count ?? undefined,
    sourceFileUploadedAt: row.source_uploaded_at ?? undefined,
    importedAt: row.imported_at,
  };
}

function categoryFromRow(row: CategoryRow): CategorySummary {
  return {
    categoryId: row.category_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    memberCount: row.member_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function elementFromRow(row: ReferenceElementRow): ServiceElement {
  return {
    elementRowId: row.element_row_id,
    managementPackId: row.management_pack_id,
    systemName: row.system_name,
    version: row.version,
    id: row.element_id,
    type: row.element_type,
    section: row.section_key,
    group: row.group_name,
    displayName: row.display_name,
    description: row.description ?? undefined,
    target: row.target ?? undefined,
    base: row.base ?? undefined,
    accessibility: row.accessibility ?? undefined,
    enabled: row.enabled ?? undefined,
    category: row.category ?? undefined,
    parent: row.parent ?? undefined,
    detail: jsonParse(row.detail_json, {}),
    rawXml: row.raw_xml || undefined,
  };
}

function slugifyCategory(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `category-${crypto.randomUUID().slice(0, 8)}`;
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

export function latestPacksBySystemName(packs: ServicePackSummary[]) {
  const latest = new Map<string, ServicePackSummary>();

  for (const pack of packs) {
    const current = latest.get(pack.systemName);

    if (!current) {
      latest.set(pack.systemName, pack);
      continue;
    }

    const versionDiff = compareVersions(pack.version, current.version);
    const packTime = new Date(pack.importedAt).getTime() || 0;
    const currentTime = new Date(current.importedAt).getTime() || 0;

    if (versionDiff > 0 || (versionDiff === 0 && packTime > currentTime)) {
      latest.set(pack.systemName, pack);
    }
  }

  return Array.from(latest.values()).sort((left, right) =>
    left.systemName.localeCompare(right.systemName)
  );
}

function sumPackCounts(
  packs: ServicePackSummary[],
  key: "sectionCounts" | "elementTypeCounts"
) {
  const counts: Record<string, number> = {};

  for (const pack of packs) {
    for (const [countKey, value] of Object.entries(pack[key] ?? {})) {
      counts[countKey] = (counts[countKey] ?? 0) + value;
    }
  }

  return counts;
}

type TableInfoRow = {
  name: string;
};

const referencePackSelect = `
  p.management_pack_id,
  p.system_name,
  p.display_name,
  p.version,
  p.category,
  p.description,
  p.source_file_name,
  p.source_kind,
  p.section_counts,
  p.element_type_counts,
  p.r2_key,
  p.source_file_id,
  p.imported_at,
  sf.original_file_name AS source_original_file_name,
  sf.file_extension AS source_file_extension,
  sf.content_type AS source_content_type,
  sf.file_size AS source_file_size,
  sf.sha256 AS source_sha256,
  sf.processing_status AS source_processing_status,
  sf.processing_message AS source_processing_message,
  sf.extracted_pack_count AS source_extracted_pack_count,
  sf.uploaded_at AS source_uploaded_at,
  sf.updated_at AS source_updated_at,
  sf.r2_key AS source_r2_key
`;

async function ensureTableColumn(
  db: D1Database,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = ((columns.results ?? []) as unknown as TableInfoRow[]).some(
    (column) => column.name === columnName
  );

  if (!hasColumn) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`).run();
  }
}

export async function ensureReferenceSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_source_files (
      source_file_id TEXT PRIMARY KEY,
      original_file_name TEXT NOT NULL,
      file_extension TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT NOT NULL,
      r2_key TEXT,
      processing_status TEXT NOT NULL DEFAULT 'uploaded',
      processing_message TEXT NOT NULL DEFAULT '',
      extracted_pack_count INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_imports (
      management_pack_id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      version TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Imported',
      description TEXT NOT NULL DEFAULT '',
      source_file_id TEXT,
      source_file_name TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      section_counts TEXT NOT NULL DEFAULT '{}',
      element_type_counts TEXT NOT NULL DEFAULT '{}',
      r2_key TEXT,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(system_name, version, source_file_name),
      FOREIGN KEY (source_file_id) REFERENCES mp_source_files(source_file_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_import_references (
      reference_row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      management_pack_id INTEGER NOT NULL,
      alias TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '',
      public_key_token TEXT,
      raw_xml TEXT,
      FOREIGN KEY (management_pack_id) REFERENCES mp_imports(management_pack_id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_reference_elements (
      element_row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      management_pack_id INTEGER NOT NULL,
      element_id TEXT NOT NULL,
      element_type TEXT NOT NULL,
      section_key TEXT NOT NULL,
      group_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      target TEXT,
      base TEXT,
      accessibility TEXT,
      enabled TEXT,
      category TEXT,
      parent TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}',
      raw_xml TEXT NOT NULL DEFAULT '',
      searchable_text TEXT NOT NULL,
      FOREIGN KEY (management_pack_id) REFERENCES mp_imports(management_pack_id) ON DELETE CASCADE,
      UNIQUE(management_pack_id, element_type, element_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS mp_category_members (
      category_id INTEGER NOT NULL,
      management_pack_id INTEGER NOT NULL,
      added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (category_id, management_pack_id),
      FOREIGN KEY (category_id) REFERENCES mp_categories(category_id) ON DELETE CASCADE,
      FOREIGN KEY (management_pack_id) REFERENCES mp_imports(management_pack_id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_imports_name_version_idx ON mp_imports (system_name, version)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_reference_elements_type_idx ON mp_reference_elements (element_type)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_reference_elements_pack_type_idx ON mp_reference_elements (management_pack_id, element_type)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_reference_elements_search_idx ON mp_reference_elements (searchable_text)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_category_members_pack_idx ON mp_category_members (management_pack_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_source_files_sha256_idx ON mp_source_files (sha256)"),
    db.prepare("CREATE INDEX IF NOT EXISTS mp_source_files_r2_key_idx ON mp_source_files (r2_key)"),
  ]);

  await ensureTableColumn(db, "mp_imports", "source_file_id", "source_file_id TEXT");
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS mp_imports_source_file_idx ON mp_imports (source_file_id)"),
  ]);
}

function normalizePackStorage(
  storage: ReferencePackStorage | string | null
): ReferencePackStorage {
  if (typeof storage === "string") {
    return { r2Key: storage };
  }

  return storage ?? { r2Key: null };
}

export async function saveSourceFileRecord(db: D1Database, input: SourceFileInput) {
  await ensureReferenceSchema(db);
  await db
    .prepare(`INSERT INTO mp_source_files (
      source_file_id, original_file_name, file_extension, source_kind,
      content_type, file_size, sha256, r2_key, processing_status,
      processing_message, extracted_pack_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_file_id) DO UPDATE SET
      original_file_name = excluded.original_file_name,
      file_extension = excluded.file_extension,
      source_kind = excluded.source_kind,
      content_type = excluded.content_type,
      file_size = excluded.file_size,
      sha256 = excluded.sha256,
      r2_key = excluded.r2_key,
      processing_status = excluded.processing_status,
      processing_message = excluded.processing_message,
      extracted_pack_count = excluded.extracted_pack_count,
      updated_at = CURRENT_TIMESTAMP`)
    .bind(
      input.sourceFileId,
      input.originalFileName,
      input.fileExtension,
      input.sourceKind,
      input.contentType,
      input.fileSize,
      input.sha256,
      input.r2Key,
      input.processingStatus ?? "uploaded",
      input.processingMessage ?? "",
      input.extractedPackCount ?? 0
    )
    .run();
}

export async function updateSourceFileRecord(
  db: D1Database,
  sourceFileId: string,
  input: {
    processingStatus?: string;
    processingMessage?: string;
    extractedPackCount?: number;
  }
) {
  await ensureReferenceSchema(db);
  await db
    .prepare(`UPDATE mp_source_files SET
      processing_status = COALESCE(?, processing_status),
      processing_message = COALESCE(?, processing_message),
      extracted_pack_count = COALESCE(?, extracted_pack_count),
      updated_at = CURRENT_TIMESTAMP
    WHERE source_file_id = ?`)
    .bind(
      input.processingStatus ?? null,
      input.processingMessage ?? null,
      input.extractedPackCount ?? null,
      sourceFileId
    )
    .run();
}

export async function getSourceFileRecord(db: D1Database, sourceFileId: string) {
  await ensureReferenceSchema(db);
  const row = await db
    .prepare("SELECT * FROM mp_source_files WHERE source_file_id = ?")
    .bind(sourceFileId)
    .first<SourceFileRow>();

  return row ? sourceFileFromRow(row) : null;
}

async function upsertPack(
  db: D1Database,
  pack: ReferencePack,
  storage: ReferencePackStorage
) {
  const existing = await db
    .prepare(`SELECT management_pack_id FROM mp_imports
      WHERE system_name = ? AND version = ? AND source_file_name = ?`)
    .bind(pack.systemName, pack.version, pack.fileName)
    .first<{ management_pack_id: number }>();

  if (existing?.management_pack_id) {
    await db
      .prepare(`UPDATE mp_imports SET
        display_name = ?,
        category = ?,
        description = ?,
        source_kind = ?,
        section_counts = ?,
        element_type_counts = ?,
        r2_key = ?,
        source_file_id = ?,
        imported_at = CURRENT_TIMESTAMP
      WHERE management_pack_id = ?`)
      .bind(
        pack.displayName,
        pack.category,
        pack.description,
        pack.sourceKind,
        JSON.stringify(pack.sectionCounts),
        JSON.stringify(pack.elementTypeCounts),
        storage.r2Key,
        storage.sourceFileId ?? null,
        existing.management_pack_id
      )
      .run();

    return existing.management_pack_id;
  }

  await db
    .prepare(`INSERT INTO mp_imports (
      system_name, display_name, version, category, description, source_file_name,
      source_kind, section_counts, element_type_counts, r2_key, source_file_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      pack.systemName,
      pack.displayName,
      pack.version,
      pack.category,
      pack.description,
      pack.fileName,
      pack.sourceKind,
      JSON.stringify(pack.sectionCounts),
      JSON.stringify(pack.elementTypeCounts),
      storage.r2Key,
      storage.sourceFileId ?? null
    )
    .run();

  const created = await db
    .prepare("SELECT last_insert_rowid() AS management_pack_id")
    .first<{ management_pack_id: number }>();

  return created?.management_pack_id ?? 0;
}

export async function saveReferencePack(
  db: D1Database,
  pack: ReferencePack,
  storage: ReferencePackStorage | string | null
) {
  await ensureReferenceSchema(db);
  const managementPackId = await upsertPack(db, pack, normalizePackStorage(storage));

  if (!managementPackId) {
    throw new Error("The management pack import row could not be created.");
  }

  await db.batch([
    db.prepare("DELETE FROM mp_import_references WHERE management_pack_id = ?").bind(managementPackId),
    db.prepare("DELETE FROM mp_reference_elements WHERE management_pack_id = ?").bind(managementPackId),
  ]);

  await runBatch(
    db,
    pack.references.map((reference) =>
      db
        .prepare(`INSERT INTO mp_import_references (
          management_pack_id, alias, reference_id, version, public_key_token, raw_xml
        ) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(
          managementPackId,
          reference.alias,
          reference.id,
          reference.version,
          reference.publicKeyToken ?? null,
          reference.rawXml
        )
    )
  );

  await runBatch(
    db,
    pack.elements.map((element) =>
      db
        .prepare(`INSERT INTO mp_reference_elements (
          management_pack_id, element_id, element_type, section_key, group_name,
          display_name, description, target, base, accessibility, enabled,
          category, parent, detail_json, raw_xml, searchable_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          managementPackId,
          element.id,
          element.type,
          element.section,
          element.group,
          element.displayName,
          element.description ?? null,
          element.target ?? null,
          element.base ?? null,
          element.accessibility ?? null,
          element.enabled ?? null,
          element.category ?? null,
          element.parent ?? null,
          JSON.stringify(element.detail),
          element.rawXml,
          element.searchableText
        )
    )
  );

  return managementPackId;
}

export async function listReferencePacks(db: D1Database, filters: QueryFilters = {}) {
  await ensureReferenceSchema(db);
  const where: string[] = [];
  const bindings: unknown[] = [];

  if (filters.managementPack) {
    where.push("p.system_name = ?");
    bindings.push(filters.managementPack);
  }

  if (filters.version) {
    where.push("p.version = ?");
    bindings.push(filters.version);
  }

  if (filters.category) {
    where.push("p.category = ?");
    bindings.push(filters.category);
  }

  const query = `SELECT ${referencePackSelect}
    FROM mp_imports AS p
    LEFT JOIN mp_source_files AS sf
      ON sf.source_file_id = p.source_file_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.imported_at DESC, p.system_name, p.version`;
  const result = await db.prepare(query).bind(...bindings).all();
  return ((result.results ?? []) as unknown as ReferencePackRow[]).map(packFromRow);
}

export async function listManagementPackCategories(db: D1Database) {
  await ensureReferenceSchema(db);

  const result = await db
    .prepare(`SELECT
        c.category_id,
        c.slug,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(m.management_pack_id) AS member_count
      FROM mp_categories AS c
      LEFT JOIN mp_category_members AS m
        ON m.category_id = c.category_id
      GROUP BY
        c.category_id,
        c.slug,
        c.name,
        c.description,
        c.created_at,
        c.updated_at
      ORDER BY c.name`)
    .all();

  return ((result.results ?? []) as unknown as CategoryRow[]).map(categoryFromRow);
}

async function categoryRowBySlug(db: D1Database, slug: string) {
  return db
    .prepare(`SELECT
        c.category_id,
        c.slug,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(m.management_pack_id) AS member_count
      FROM mp_categories AS c
      LEFT JOIN mp_category_members AS m
        ON m.category_id = c.category_id
      WHERE c.slug = ?
      GROUP BY
        c.category_id,
        c.slug,
        c.name,
        c.description,
        c.created_at,
        c.updated_at`)
    .bind(slug)
    .first<CategoryRow>();
}

async function categoryRowById(db: D1Database, categoryId: number) {
  return db
    .prepare(`SELECT
        c.category_id,
        c.slug,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(m.management_pack_id) AS member_count
      FROM mp_categories AS c
      LEFT JOIN mp_category_members AS m
        ON m.category_id = c.category_id
      WHERE c.category_id = ?
      GROUP BY
        c.category_id,
        c.slug,
        c.name,
        c.description,
        c.created_at,
        c.updated_at`)
    .bind(categoryId)
    .first<CategoryRow>();
}

async function categoryDetailFromRow(
  db: D1Database,
  row: CategoryRow
): Promise<CategoryDetail> {
  const result = await db
    .prepare(`SELECT ${referencePackSelect}
      FROM mp_imports AS p
      LEFT JOIN mp_source_files AS sf
        ON sf.source_file_id = p.source_file_id
      INNER JOIN mp_category_members AS m
        ON m.management_pack_id = p.management_pack_id
      WHERE m.category_id = ?
      ORDER BY p.system_name, p.version, p.imported_at DESC`)
    .bind(row.category_id)
    .all();
  const members = ((result.results ?? []) as unknown as ReferencePackRow[]).map(packFromRow);
  const latestMembers = latestPacksBySystemName(members);

  return {
    ...categoryFromRow(row),
    members,
    latestMembers,
    sectionCounts: sumPackCounts(latestMembers, "sectionCounts"),
    elementTypeCounts: sumPackCounts(latestMembers, "elementTypeCounts"),
  };
}

export async function createManagementPackCategory(
  db: D1Database,
  input: { name: string; slug?: string; description?: string }
) {
  await ensureReferenceSchema(db);

  const name = input.name.trim();

  if (!name) {
    throw new Error("Category name is required.");
  }

  const slug = slugifyCategory(input.slug || name);
  const description = input.description?.trim() ?? "";
  const existing = await categoryRowBySlug(db, slug);

  if (existing) {
    throw new Error("A category with that name already exists.");
  }

  await db
    .prepare(`INSERT INTO mp_categories (slug, name, description)
      VALUES (?, ?, ?)`)
    .bind(slug, name, description)
    .run();

  const row = await categoryRowBySlug(db, slug);

  if (!row) {
    throw new Error("Category could not be created.");
  }

  return categoryDetailFromRow(db, row);
}

export async function updateManagementPackCategoryMembership(
  db: D1Database,
  categoryId: number,
  managementPackIds: number[]
) {
  await ensureReferenceSchema(db);

  const row = await categoryRowById(db, categoryId);

  if (!row) {
    return null;
  }

  const uniqueIds = Array.from(
    new Set(
      managementPackIds.filter(
        (managementPackId) =>
          Number.isInteger(managementPackId) && managementPackId > 0
      )
    )
  );

  const statements = [
    db.prepare("DELETE FROM mp_category_members WHERE category_id = ?").bind(categoryId),
    ...uniqueIds.map((managementPackId) =>
      db
        .prepare(`INSERT INTO mp_category_members (category_id, management_pack_id)
          VALUES (?, ?)`)
        .bind(categoryId, managementPackId)
    ),
    db.prepare("UPDATE mp_categories SET updated_at = CURRENT_TIMESTAMP WHERE category_id = ?").bind(categoryId),
  ];

  await runBatch(db, statements);
  const updated = await categoryRowById(db, categoryId);

  return updated ? categoryDetailFromRow(db, updated) : null;
}

export async function getManagementPackCategory(db: D1Database, slug: string) {
  await ensureReferenceSchema(db);
  const normalizedSlug = slugifyCategory(slug);
  const row = await categoryRowBySlug(db, normalizedSlug);

  return row ? categoryDetailFromRow(db, row) : null;
}

export async function getReferencePack(
  db: D1Database,
  managementPack: string,
  version?: string
) {
  const packs = await listReferencePacks(db, { managementPack, version });
  const pack = packs[0];

  if (!pack) {
    return null;
  }

  return referencePackWithReferences(db, pack);
}

export async function getReferencePackById(
  db: D1Database,
  managementPackId: number
) {
  await ensureReferenceSchema(db);

  const row = await db
    .prepare(`SELECT ${referencePackSelect}
      FROM mp_imports AS p
      LEFT JOIN mp_source_files AS sf
        ON sf.source_file_id = p.source_file_id
      WHERE p.management_pack_id = ?`)
    .bind(managementPackId)
    .first<ReferencePackRow>();

  if (!row) {
    return null;
  }

  return referencePackWithReferences(db, packFromRow(row));
}

async function referencePackWithReferences(
  db: D1Database,
  pack: ServicePackSummary
) {
  const referencesResult = await db
    .prepare(`SELECT alias, reference_id, version, public_key_token
      FROM mp_import_references
      WHERE management_pack_id = ?
      ORDER BY alias`)
    .bind(pack.managementPackId)
    .all();

  const references = (referencesResult.results ?? []) as unknown as ReferenceRow[];

  return {
    ...pack,
    references: references.map((reference) => ({
      alias: reference.alias,
      id: reference.reference_id,
      version: reference.version,
      publicKeyToken: reference.public_key_token ?? undefined,
    })),
  };
}

export async function listReferenceElements(db: D1Database, filters: QueryFilters = {}) {
  await ensureReferenceSchema(db);
  const where: string[] = [];
  const bindings: unknown[] = [];

  if (filters.managementPack) {
    where.push("p.system_name = ?");
    bindings.push(filters.managementPack);
  }

  if (filters.version) {
    where.push("p.version = ?");
    bindings.push(filters.version);
  }

  if (filters.category) {
    where.push("p.category = ?");
    bindings.push(filters.category);
  }

  if (filters.type) {
    where.push("e.element_type = ?");
    bindings.push(filters.type);
  }

  if (filters.elementId) {
    where.push("e.element_id = ?");
    bindings.push(filters.elementId);
  }

  if (filters.section) {
    where.push("e.section_key = ?");
    bindings.push(filters.section);
  }

  if (filters.search) {
    where.push("e.searchable_text LIKE ?");
    bindings.push(`%${filters.search.toLowerCase()}%`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 250, 1), 5000);
  const offset = Math.max(filters.offset ?? 0, 0);
  bindings.push(limit, offset);

  const result = await db
    .prepare(`SELECT
        e.*,
        p.system_name,
        p.version
      FROM mp_reference_elements AS e
      INNER JOIN mp_imports AS p
        ON p.management_pack_id = e.management_pack_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY p.system_name, p.version, e.element_type, e.display_name
      LIMIT ? OFFSET ?`)
    .bind(...bindings)
    .all();

  return ((result.results ?? []) as unknown as ReferenceElementRow[]).map(elementFromRow);
}

export async function getReferenceElement(
  db: D1Database,
  elementId: string,
  filters: QueryFilters = {}
) {
  const elements = await listReferenceElements(db, {
    ...filters,
    elementId,
    search: undefined,
    limit: 10,
  });

  return (
    elements.find(
      (element) =>
        element.id === elementId &&
        (!filters.type || element.type === filters.type)
    ) ?? null
  );
}

export async function listElementTypes(db: D1Database, filters: QueryFilters = {}) {
  await ensureReferenceSchema(db);
  const where: string[] = [];
  const bindings: unknown[] = [];

  if (filters.managementPack) {
    where.push("p.system_name = ?");
    bindings.push(filters.managementPack);
  }

  if (filters.version) {
    where.push("p.version = ?");
    bindings.push(filters.version);
  }

  if (filters.category) {
    where.push("p.category = ?");
    bindings.push(filters.category);
  }

  const result = await db
    .prepare(`SELECT e.element_type, e.section_key, e.group_name, COUNT(*) AS count
      FROM mp_reference_elements AS e
      INNER JOIN mp_imports AS p
        ON p.management_pack_id = e.management_pack_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY e.element_type, e.section_key, e.group_name
      ORDER BY e.group_name, e.element_type`)
    .bind(...bindings)
    .all();

  return result.results ?? [];
}

export function packToSummaryElements(pack: ReferencePack) {
  return pack.elements.map((element) => ({
    id: element.id,
    section: element.section,
    type: element.type,
    displayName: element.displayName,
    target: element.target ?? element.base,
    category: element.category,
    enabled: element.enabled,
    alertGenerate:
      typeof element.detail.generatedAlert === "object" || typeof element.detail.alertSettings === "object"
        ? "True"
        : undefined,
    accessibility: element.accessibility,
    detail: element.description,
  }));
}
