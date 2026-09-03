import Database from "@tauri-apps/plugin-sql";
import type { CompletedDownload } from "../types/download";

export interface HistoryItem extends CompletedDownload {
  id: string;
  createdAt: number;
}

const DB_NAME = "sqlite:history.db";
const STORAGE_KEY = "tubelite-download-history";

let dbPromise: Promise<Database> | null = null;

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readBrowserHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch (error) {
    console.error("[History] failed to read browser history:", error);
    return [];
  }
}

function writeBrowserHistory(items: HistoryItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_NAME);
  }
  return dbPromise;
}

export async function initializeHistory(): Promise<HistoryItem[]> {
  if (!isTauri()) {
    return readBrowserHistory();
  }

  const db = await getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS download_history (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT NOT NULL,
      size TEXT NOT NULL,
      duration TEXT,
      thumbnail_url TEXT,
      filepath TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  const rows = await db.select<
    Array<{
      id: string;
      title: string;
      type: "video" | "audio";
      format: string;
      size: string;
      duration: string | null;
      thumbnail_url: string | null;
      filepath: string | null;
      created_at: number;
    }>
  >(
    `SELECT id, title, type, format, size, duration, thumbnail_url, filepath, created_at
     FROM download_history
     ORDER BY created_at DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    format: row.format,
    size: row.size,
    duration: row.duration ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    filepath: row.filepath ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function addToHistory(
  file: CompletedDownload,
): Promise<HistoryItem> {
  const item: HistoryItem = {
    ...file,
    id: createId(),
    createdAt: Date.now(),
  };

  if (!isTauri()) {
    const items = readBrowserHistory();
    writeBrowserHistory([item, ...items]);
    return item;
  }

  const db = await getDb();

  // initializeHistory creates the table if this is the first database access.
  await initializeHistory();

  await db.execute(
    `INSERT INTO download_history
      (id, title, type, format, size, duration, thumbnail_url, filepath, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.title,
      item.type,
      item.format,
      item.size,
      item.duration ?? null,
      item.thumbnailUrl ?? null,
      item.filepath ?? null,
      item.createdAt,
    ],
  );

  return item;
}

export async function removeFromHistory(id: string): Promise<void> {
  if (!isTauri()) {
    writeBrowserHistory(readBrowserHistory().filter((item) => item.id !== id));
    return;
  }

  const db = await getDb();
  await db.execute("DELETE FROM download_history WHERE id = ?", [id]);
}

export async function clearHistory(): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const db = await getDb();
  await initializeHistory();
  await db.execute("DELETE FROM download_history");
}
