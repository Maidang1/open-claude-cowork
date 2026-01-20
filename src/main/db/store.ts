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

    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        workspace TEXT NOT NULL,
        agent_command TEXT NOT NULL,
        agent_env TEXT,
        messages TEXT,
        session_id TEXT,
        model_id TEXT,
        token_usage TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL
      )
    `);
  } catch (e) {
    console.error("[DB] Failed to initialize database:", e);
  }
};

export const setSetting = (key: string, value: string) => {
  if (!db) return;
  try {
    const stmt = db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    );
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

type TaskRecord = {
  id: string;
  title: string;
  workspace: string;
  agentCommand: string;
  agentEnv: Record<string, string>;
  messages: unknown[];
  sessionId: string | null;
  modelId: string | null;
  tokenUsage: unknown | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
};

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeTaskRow = (row: any): TaskRecord => ({
  id: row.id,
  title: row.title,
  workspace: row.workspace,
  agentCommand: row.agent_command,
  agentEnv: parseJson<Record<string, string>>(row.agent_env, {}),
  messages: parseJson<unknown[]>(row.messages, []),
  sessionId: row.session_id ?? null,
  modelId: row.model_id ?? null,
  tokenUsage: parseJson<unknown | null>(row.token_usage, null),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastActiveAt: row.last_active_at,
});

export const listTasks = (): TaskRecord[] => {
  if (!db) return [];
  try {
    const stmt = db.prepare(
      "SELECT * FROM tasks ORDER BY last_active_at DESC, created_at DESC",
    );
    const rows = stmt.all() as any[];
    return rows.map(normalizeTaskRow);
  } catch (e) {
    console.error("[DB] Failed to list tasks:", e);
    return [];
  }
};

export const getTask = (id: string): TaskRecord | null => {
  if (!db) return null;
  try {
    const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? normalizeTaskRow(row) : null;
  } catch (e) {
    console.error(`[DB] Failed to get task ${id}:`, e);
    return null;
  }
};

export const createTask = (task: TaskRecord) => {
  if (!db) return;
  try {
    const stmt = db.prepare(`
      INSERT INTO tasks (
        id, title, workspace, agent_command, agent_env, messages,
        session_id, model_id, token_usage, created_at, updated_at, last_active_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      task.id,
      task.title,
      task.workspace,
      task.agentCommand,
      JSON.stringify(task.agentEnv ?? {}),
      JSON.stringify(task.messages ?? []),
      task.sessionId,
      task.modelId,
      JSON.stringify(task.tokenUsage ?? null),
      task.createdAt,
      task.updatedAt,
      task.lastActiveAt,
    );
  } catch (e) {
    console.error(`[DB] Failed to create task ${task.id}:`, e);
  }
};

export const updateTask = (
  id: string,
  updates: Partial<
    Omit<TaskRecord, "id"> & {
      agentCommand: string;
      agentEnv: Record<string, string>;
      messages: unknown[];
      sessionId: string | null;
      modelId: string | null;
      tokenUsage: unknown | null;
      createdAt: number;
      updatedAt: number;
      lastActiveAt: number;
    }
  >,
) => {
  if (!db) return;
  const fields: string[] = [];
  const values: any[] = [];

  const setField = (field: string, value: any) => {
    fields.push(`${field} = ?`);
    values.push(value);
  };

  if (updates.title !== undefined) setField("title", updates.title);
  if (updates.workspace !== undefined) setField("workspace", updates.workspace);
  if (updates.agentCommand !== undefined)
    setField("agent_command", updates.agentCommand);
  if (updates.agentEnv !== undefined)
    setField("agent_env", JSON.stringify(updates.agentEnv ?? {}));
  if (updates.messages !== undefined)
    setField("messages", JSON.stringify(updates.messages ?? []));
  if (updates.sessionId !== undefined)
    setField("session_id", updates.sessionId);
  if (updates.modelId !== undefined) setField("model_id", updates.modelId);
  if (updates.tokenUsage !== undefined)
    setField("token_usage", JSON.stringify(updates.tokenUsage ?? null));
  if (updates.createdAt !== undefined)
    setField("created_at", updates.createdAt);
  if (updates.updatedAt !== undefined)
    setField("updated_at", updates.updatedAt);
  if (updates.lastActiveAt !== undefined)
    setField("last_active_at", updates.lastActiveAt);

  if (fields.length === 0) return;

  try {
    const stmt = db.prepare(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
    );
    stmt.run(...values, id);
  } catch (e) {
    console.error(`[DB] Failed to update task ${id}:`, e);
  }
};

export const deleteTask = (id: string) => {
  if (!db) return;
  try {
    const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
    stmt.run(id);
  } catch (e) {
    console.error(`[DB] Failed to delete task ${id}:`, e);
  }
};
