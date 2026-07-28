import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "seo-geo.db");

declare global {
  var __seoGeoDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pillar_keyword TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      title TEXT NOT NULL,
      page_type TEXT NOT NULL DEFAULT 'other',
      target_keyword TEXT,
      cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      owner TEXT,
      target_publish_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      seo_score INTEGER NOT NULL,
      geo_score INTEGER NOT NULL,
      results_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audits_page_id ON audits(page_id);
    CREATE INDEX IF NOT EXISTS idx_pages_cluster_id ON pages(cluster_id);
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!global.__seoGeoDb) {
    global.__seoGeoDb = createDb();
  }
  return global.__seoGeoDb;
}
