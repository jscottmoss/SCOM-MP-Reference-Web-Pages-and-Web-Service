import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const managementPacks = sqliteTable("management_packs", {
  systemName: text("system_name").primaryKey(),
  displayName: text("display_name").notNull(),
  version: text("version").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  fileName: text("file_name"),
  sourceKind: text("source_kind").notNull(),
  sectionCounts: text("section_counts").notNull().default("{}"),
  r2Key: text("r2_key"),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mpSourceFiles = sqliteTable("mp_source_files", {
  sourceFileId: text("source_file_id").primaryKey(),
  originalFileName: text("original_file_name").notNull(),
  fileExtension: text("file_extension").notNull(),
  sourceKind: text("source_kind").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  fileSize: integer("file_size").notNull().default(0),
  sha256: text("sha256").notNull(),
  r2Key: text("r2_key"),
  processingStatus: text("processing_status").notNull().default("uploaded"),
  processingMessage: text("processing_message").notNull().default(""),
  extractedPackCount: integer("extracted_pack_count").notNull().default(0),
  uploadedAt: text("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mpReferences = sqliteTable("mp_references", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mpSystemName: text("mp_system_name").notNull(),
  alias: text("alias").notNull(),
  referenceId: text("reference_id").notNull(),
  version: text("version").notNull().default(""),
  publicKeyToken: text("public_key_token"),
});

export const mpElements = sqliteTable("mp_elements", {
  id: text("id").primaryKey(),
  mpSystemName: text("mp_system_name").notNull(),
  sectionKey: text("section_key").notNull(),
  elementType: text("element_type").notNull(),
  displayName: text("display_name").notNull(),
  target: text("target"),
  category: text("category"),
  enabled: text("enabled"),
  alertGenerate: text("alert_generate"),
  accessibility: text("accessibility"),
  detail: text("detail"),
  searchableText: text("searchable_text").notNull(),
});

export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  r2Key: text("r2_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
