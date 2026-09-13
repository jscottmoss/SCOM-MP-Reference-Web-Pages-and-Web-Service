-- SCOM MP Reference local database reset script
--
-- Use this against a local SQLite/D1 database when you want the web catalog
-- to start with no original source-file metadata, no imported management packs,
-- no references, no elements, no import jobs, and no category assignments.
--
-- The application recreates these tables automatically the next time the
-- local preview imports or queries management pack data.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

DROP TABLE IF EXISTS mp_category_members;
DROP TABLE IF EXISTS mp_import_references;
DROP TABLE IF EXISTS mp_reference_elements;
DROP TABLE IF EXISTS mp_categories;
DROP TABLE IF EXISTS mp_imports;
DROP TABLE IF EXISTS mp_source_files;

DROP TABLE IF EXISTS import_jobs;
DROP TABLE IF EXISTS mp_references;
DROP TABLE IF EXISTS mp_elements;
DROP TABLE IF EXISTS management_packs;

COMMIT;

PRAGMA foreign_keys = ON;
