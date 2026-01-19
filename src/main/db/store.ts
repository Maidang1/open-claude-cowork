import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export const initDB = () => {
  const dbPath = path.join(app.getPath("userData"), "app.db");
  console.log(`[DB] Initializing database at ${dbPath}`);
  
  try {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    
    // Create settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  } catch (e) {
    console.error("[DB] Failed to initialize database:", e);
  }
};

export const setSetting = (key: string, value: string) => {
  if (!db) return;
  try {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    stmt.run(key, value);
  } catch (e) {
    console.error(`[DB] Failed to set setting ${key}:`, e);
  }
};

export const getSetting = (key: string): string | null => {
  if (!db) return null;
  try {
    const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  } catch (e) {
    console.error(`[DB] Failed to get setting ${key}:`, e);
    return null;
  }
};
