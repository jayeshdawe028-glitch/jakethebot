import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS premium_staff (
  user_id TEXT PRIMARY KEY,
  slot_limit INTEGER NOT NULL CHECK(slot_limit >= 0),
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS premium_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('guild','user')),
  subject_id TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'staff',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  removed_by TEXT,
  removed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_premium_active ON premium_entitlements(active, expires_at);
CREATE TABLE IF NOT EXISTS radio_247 (\n  guild_id TEXT PRIMARY KEY,\n  voice_channel_id TEXT NOT NULL,\n  text_channel_id TEXT NOT NULL,\n  station_name TEXT NOT NULL,\n  stream_url TEXT NOT NULL,\n  enabled_by TEXT NOT NULL,\n  enabled_at INTEGER NOT NULL\n);\nCREATE TABLE IF NOT EXISTS music_247 (
  guild_id TEXT PRIMARY KEY,
  voice_channel_id TEXT NOT NULL,
  text_channel_id TEXT NOT NULL,
  enabled_by TEXT NOT NULL,
  enabled_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS premium_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
`);

export const DAY = 86400000;
export const isOwner = id => id === config.ownerId;
export const getStaff = id => db.prepare('SELECT * FROM premium_staff WHERE user_id=?').get(id) ?? null;
export function activeGuildPremium(guildId) {
  return db.prepare("SELECT * FROM premium_entitlements WHERE subject_type='guild' AND subject_id=? AND active=1 AND expires_at>? ORDER BY id DESC LIMIT 1").get(guildId, Date.now()) ?? null;
}
export function audit(actor, action, type=null, id=null, details={}) {
  db.prepare('INSERT INTO premium_audit(actor_id,action,subject_type,subject_id,details,created_at) VALUES(?,?,?,?,?,?)')
    .run(actor, action, type, id, JSON.stringify(details), Date.now());
}
export function expireEntitlements() {
  const now = Date.now();
  const rows = db.prepare('SELECT id,subject_type,subject_id FROM premium_entitlements WHERE active=1 AND expires_at<=?').all(now);
  const tx = db.transaction(() => {
    for (const r of rows) {
      db.prepare("UPDATE premium_entitlements SET active=0,removed_by='system',removed_at=? WHERE id=?").run(now,r.id);
      audit('system','premium_expired',r.subject_type,r.subject_id,{entitlementId:r.id});
    }
  });
  tx();
  return rows.length;
}
