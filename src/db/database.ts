import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Use the /app/data path when running in Docker, otherwise use relative path
const dbPath = process.env.DOCKER
  ? "/app/data/data.db"
  : path.join(__dirname, "../../data/data.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS monitored_channels (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pending_sorts (
    prompt_message_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    source_message_id TEXT NOT NULL,
    files TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

interface Setting {
  value: string;
}

interface MonitoredChannel {
  channel_id: string;
  guild_id: string;
}

export const getTwitterCookie = (): string | null => {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("twitter_cookie") as Setting | undefined;
  return row ? row.value : null;
};

export const setTwitterCookie = (cookie: string): void => {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
  );
  stmt.run("twitter_cookie", cookie);
};

export const addMonitoredChannel = (
  channelId: string,
  guildId: string
): void => {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO monitored_channels (channel_id, guild_id) VALUES (?, ?)"
  );
  stmt.run(channelId, guildId);
};

export const removeMonitoredChannel = (channelId: string): void => {
  const stmt = db.prepare(
    "DELETE FROM monitored_channels WHERE channel_id = ?"
  );
  stmt.run(channelId);
};

export const isChannelMonitored = (channelId: string): boolean => {
  const row = db
    .prepare("SELECT 1 FROM monitored_channels WHERE channel_id = ?")
    .get(channelId);
  return !!row;
};

export const getAllMonitoredChannels = (): Array<MonitoredChannel> => {
  return db
    .prepare("SELECT channel_id, guild_id FROM monitored_channels")
    .all() as Array<MonitoredChannel>;
};

const DEFAULT_SORT_FOLDERS = ["cartoon", "furry", "pony", "real"];

export const getSortFolders = (): string[] => {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("sort_folders") as Setting | undefined;
  return row ? (JSON.parse(row.value) as string[]) : DEFAULT_SORT_FOLDERS;
};

export const setSortFolders = (folders: string[]): void => {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
  );
  stmt.run("sort_folders", JSON.stringify(folders));
};

export interface PendingSort {
  prompt_message_id: string;
  channel_id: string;
  source_message_id: string;
  files: string[];
}

export const addPendingSort = (sort: PendingSort): void => {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO pending_sorts (prompt_message_id, channel_id, source_message_id, files) VALUES (?, ?, ?, ?)"
  );
  stmt.run(
    sort.prompt_message_id,
    sort.channel_id,
    sort.source_message_id,
    JSON.stringify(sort.files)
  );
};

export const getPendingSort = (promptMessageId: string): PendingSort | null => {
  const row = db
    .prepare(
      "SELECT prompt_message_id, channel_id, source_message_id, files FROM pending_sorts WHERE prompt_message_id = ?"
    )
    .get(promptMessageId) as (Omit<PendingSort, "files"> & { files: string }) | undefined;
  return row ? { ...row, files: JSON.parse(row.files) as string[] } : null;
};

export const removePendingSort = (promptMessageId: string): void => {
  const stmt = db.prepare(
    "DELETE FROM pending_sorts WHERE prompt_message_id = ?"
  );
  stmt.run(promptMessageId);
};
