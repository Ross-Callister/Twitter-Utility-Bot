import Database from "better-sqlite3";
import path from "path";

// Use the /app/data path when running in Docker, otherwise use relative path
const dbPath = process.env.DOCKER
  ? "/app/data/data.db"
  : path.join(__dirname, "../../data/data.db");

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
