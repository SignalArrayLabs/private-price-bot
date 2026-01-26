import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.js';
import type { SupportedChain } from '../config/index.js';
import type {
  GroupConfig,
  Alert,
  Call,
  WatchlistItem,
  CacheEntry,
  PriceData,
} from '../types/index.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Database.Database {
  const dbPath = config.sqlitePath;
  const dbDir = dirname(dbPath);

  // Create directory if it doesn't exist
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  logger.info({ path: dbPath }, 'Database initialized');
  return db;
}

function runMigrations(database: Database.Database): void {
  const getCurrentVersion = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
  );
  const tableExists = getCurrentVersion.get();

  let currentVersion = 0;
  if (tableExists) {
    const versionRow = database
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number } | undefined;
    currentVersion = versionRow?.version ?? 0;
  }

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      logger.info({ version: migration.version }, 'Running migration');
      database.exec(migration.sql);
      database
        .prepare('INSERT INTO schema_version (version) VALUES (?)')
        .run(migration.version);
    }
  }

  if (currentVersion < SCHEMA_VERSION) {
    logger.info(
      { from: currentVersion, to: SCHEMA_VERSION },
      'Database migrations complete'
    );
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

// ============ Group Operations ============

export function getOrCreateGroup(tgChatId: number, title?: string): GroupConfig {
  const database = getDb();

  const existing = database
    .prepare('SELECT * FROM groups WHERE tg_chat_id = ?')
    .get(tgChatId) as GroupConfig | undefined;

  if (existing) {
    if (title && title !== existing.title) {
      database
        .prepare('UPDATE groups SET title = ? WHERE tg_chat_id = ?')
        .run(title, tgChatId);
    }
    return {
      id: existing.id,
      tgChatId: existing.tgChatId,
      title: title ?? existing.title,
      defaultToken: existing.defaultToken,
      defaultChain: existing.defaultChain,
      createdAt: new Date(existing.createdAt),
    };
  }

  const result = database
    .prepare('INSERT INTO groups (tg_chat_id, title) VALUES (?, ?)')
    .run(tgChatId, title ?? null);

  return {
    id: result.lastInsertRowid as number,
    tgChatId,
    title,
    createdAt: new Date(),
  };
}

export function setGroupDefault(
  groupId: number,
  token: string,
  chain?: SupportedChain
): void {
  const database = getDb();
  database
    .prepare('UPDATE groups SET default_token = ?, default_chain = ? WHERE id = ?')
    .run(token, chain ?? null, groupId);
}

export function getGroupDefault(groupId: number): { token?: string; chain?: SupportedChain } {
  const database = getDb();
  const row = database
    .prepare('SELECT default_token, default_chain FROM groups WHERE id = ?')
    .get(groupId) as { default_token: string | null; default_chain: string | null } | undefined;

  return {
    token: row?.default_token ?? undefined,
    chain: row?.default_chain as SupportedChain | undefined,
  };
}

// ============ User Operations ============

export function getOrCreateUser(tgUserId: number, username?: string): { id: number; username?: string } {
  const database = getDb();

  const existing = database
    .prepare('SELECT id, username FROM users WHERE tg_user_id = ?')
    .get(tgUserId) as { id: number; username: string | null } | undefined;

  if (existing) {
    if (username && username !== existing.username) {
      database
        .prepare('UPDATE users SET username = ? WHERE tg_user_id = ?')
        .run(username, tgUserId);
    }
    return { id: existing.id, username: username ?? existing.username ?? undefined };
  }

  const result = database
    .prepare('INSERT INTO users (tg_user_id, username) VALUES (?, ?)')
    .run(tgUserId, username ?? null);

  return { id: result.lastInsertRowid as number, username };
}

// ============ Watchlist Operations ============

export function addToWatchlist(
  groupId: number,
  tokenRef: string,
  chain?: SupportedChain
): boolean {
  const database = getDb();
  try {
    database
      .prepare('INSERT OR IGNORE INTO watchlist (group_id, token_ref, chain) VALUES (?, ?, ?)')
      .run(groupId, tokenRef.toLowerCase(), chain ?? null);
    return true;
  } catch {
    return false;
  }
}

export function removeFromWatchlist(
  groupId: number,
  tokenRef: string,
  chain?: SupportedChain
): boolean {
  const database = getDb();
  const result = database
    .prepare('DELETE FROM watchlist WHERE group_id = ? AND token_ref = ? AND (chain = ? OR (chain IS NULL AND ? IS NULL))')
    .run(groupId, tokenRef.toLowerCase(), chain ?? null, chain ?? null);
  return result.changes > 0;
}

export function getWatchlist(groupId: number): WatchlistItem[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM watchlist WHERE group_id = ? ORDER BY created_at DESC')
    .all(groupId) as Array<{
      id: number;
      group_id: number;
      token_ref: string;
      chain: string | null;
      created_at: string;
    }>;

  return rows.map(row => ({
    id: row.id,
    groupId: row.group_id,
    tokenRef: row.token_ref,
    chain: row.chain as SupportedChain | null,
    createdAt: new Date(row.created_at),
  }));
}

export function getAllWatchlistItems(): Array<WatchlistItem & { tgChatId: number }> {
  const database = getDb();
  const rows = database
    .prepare(`
      SELECT w.*, g.tg_chat_id
      FROM watchlist w
      JOIN groups g ON w.group_id = g.id
    `)
    .all() as Array<{
      id: number;
      group_id: number;
      token_ref: string;
      chain: string | null;
      created_at: string;
      tg_chat_id: number;
    }>;

  return rows.map(row => ({
    id: row.id,
    groupId: row.group_id,
    tokenRef: row.token_ref,
    chain: row.chain as SupportedChain | null,
    createdAt: new Date(row.created_at),
    tgChatId: row.tg_chat_id,
  }));
}

// ============ Alert Operations ============

export function createAlert(
  groupId: number,
  tokenRef: string,
  direction: 'above' | 'below',
  targetPrice: number,
  chain?: SupportedChain,
  cooldownMinutes = 60
): Alert {
  const database = getDb();
  const result = database
    .prepare(`
      INSERT INTO alerts (group_id, token_ref, chain, direction, target_price, cooldown_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(groupId, tokenRef.toLowerCase(), chain ?? null, direction, targetPrice, cooldownMinutes);

  return {
    id: result.lastInsertRowid as number,
    groupId,
    tokenRef: tokenRef.toLowerCase(),
    chain: chain ?? null,
    direction,
    targetPrice,
    cooldownMinutes,
    lastTriggeredAt: null,
    isActive: true,
    createdAt: new Date(),
  };
}

export function getAlerts(groupId: number): Alert[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM alerts WHERE group_id = ? AND is_active = 1 ORDER BY created_at DESC')
    .all(groupId) as Array<{
      id: number;
      group_id: number;
      token_ref: string;
      chain: string | null;
      direction: string;
      target_price: number;
      cooldown_minutes: number;
      last_triggered_at: string | null;
      is_active: number;
      created_at: string;
    }>;

  return rows.map(row => ({
    id: row.id,
    groupId: row.group_id,
    tokenRef: row.token_ref,
    chain: row.chain as SupportedChain | null,
    direction: row.direction as 'above' | 'below',
    targetPrice: row.target_price,
    cooldownMinutes: row.cooldown_minutes,
    lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at),
  }));
}

export function getAllActiveAlerts(): Array<Alert & { tgChatId: number }> {
  const database = getDb();
  const rows = database
    .prepare(`
      SELECT a.*, g.tg_chat_id
      FROM alerts a
      JOIN groups g ON a.group_id = g.id
      WHERE a.is_active = 1
    `)
    .all() as Array<{
      id: number;
      group_id: number;
      token_ref: string;
      chain: string | null;
      direction: string;
      target_price: number;
      cooldown_minutes: number;
      last_triggered_at: string | null;
      is_active: number;
      created_at: string;
      tg_chat_id: number;
    }>;

  return rows.map(row => ({
    id: row.id,
    groupId: row.group_id,
    tokenRef: row.token_ref,
    chain: row.chain as SupportedChain | null,
    direction: row.direction as 'above' | 'below',
    targetPrice: row.target_price,
    cooldownMinutes: row.cooldown_minutes,
    lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at),
    tgChatId: row.tg_chat_id,
  }));
}

export function deleteAlert(alertId: number, groupId: number): boolean {
  const database = getDb();
  const result = database
    .prepare('DELETE FROM alerts WHERE id = ? AND group_id = ?')
    .run(alertId, groupId);
  return result.changes > 0;
}

export function markAlertTriggered(alertId: number): void {
  const database = getDb();
  database
    .prepare('UPDATE alerts SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(alertId);
}

// ============ Call Operations ============

export function createCall(
  groupId: number,
  userId: number,
  tokenRef: string,
  callPrice: number,
  chain?: SupportedChain,
  notes?: string
): Call {
  const database = getDb();
  const result = database
    .prepare(`
      INSERT INTO calls (group_id, user_id, token_ref, chain, call_price, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(groupId, userId, tokenRef.toLowerCase(), chain ?? null, callPrice, notes ?? null);

  const user = database
    .prepare('SELECT username FROM users WHERE id = ?')
    .get(userId) as { username: string | null } | undefined;

  return {
    id: result.lastInsertRowid as number,
    groupId,
    userId,
    username: user?.username ?? undefined,
    tokenRef: tokenRef.toLowerCase(),
    chain: chain ?? null,
    callPrice,
    callTime: new Date(),
    notes,
  };
}

export function getRecentCalls(groupId: number, limit = 10): Call[] {
  const database = getDb();
  const rows = database
    .prepare(`
      SELECT c.*, u.username
      FROM calls c
      JOIN users u ON c.user_id = u.id
      WHERE c.group_id = ?
      ORDER BY c.call_time DESC
      LIMIT ?
    `)
    .all(groupId, limit) as Array<{
      id: number;
      group_id: number;
      user_id: number;
      token_ref: string;
      chain: string | null;
      call_price: number;
      call_time: string;
      notes: string | null;
      username: string | null;
    }>;

  return rows.map(row => ({
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    username: row.username ?? undefined,
    tokenRef: row.token_ref,
    chain: row.chain as SupportedChain | null,
    callPrice: row.call_price,
    callTime: new Date(row.call_time),
    notes: row.notes ?? undefined,
  }));
}

export function getLeaderboardStats(groupId: number): Array<{
  userId: number;
  username?: string;
  totalCalls: number;
  tokens: string[];
}> {
  const database = getDb();
  const rows = database
    .prepare(`
      SELECT
        c.user_id,
        u.username,
        COUNT(*) as total_calls,
        GROUP_CONCAT(DISTINCT c.token_ref) as tokens
      FROM calls c
      JOIN users u ON c.user_id = u.id
      WHERE c.group_id = ?
      GROUP BY c.user_id
      ORDER BY total_calls DESC
      LIMIT 10
    `)
    .all(groupId) as Array<{
      user_id: number;
      username: string | null;
      total_calls: number;
      tokens: string;
    }>;

  return rows.map(row => ({
    userId: row.user_id,
    username: row.username ?? undefined,
    totalCalls: row.total_calls,
    tokens: row.tokens.split(','),
  }));
}

// ============ Cache Operations ============

export function getCachedPrice(
  tokenRef: string,
  chain?: SupportedChain
): CacheEntry<PriceData> | null {
  const database = getDb();
  const row = database
    .prepare(`
      SELECT data_json, fetched_at, ttl_seconds
      FROM token_cache
      WHERE token_ref = ? AND (chain = ? OR (chain IS NULL AND ? IS NULL))
    `)
    .get(tokenRef.toLowerCase(), chain ?? null, chain ?? null) as {
      data_json: string;
      fetched_at: string;
      ttl_seconds: number;
    } | undefined;

  if (!row) return null;

  const fetchedAt = new Date(row.fetched_at);
  const expiresAt = new Date(fetchedAt.getTime() + row.ttl_seconds * 1000);

  if (new Date() > expiresAt) {
    // Cache expired, delete it
    database
      .prepare('DELETE FROM token_cache WHERE token_ref = ? AND (chain = ? OR (chain IS NULL AND ? IS NULL))')
      .run(tokenRef.toLowerCase(), chain ?? null, chain ?? null);
    return null;
  }

  return {
    data: JSON.parse(row.data_json) as PriceData,
    fetchedAt,
    ttlSeconds: row.ttl_seconds,
  };
}

export function setCachedPrice(
  tokenRef: string,
  data: PriceData,
  ttlSeconds: number,
  chain?: SupportedChain
): void {
  const database = getDb();
  database
    .prepare(`
      INSERT OR REPLACE INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `)
    .run(tokenRef.toLowerCase(), chain ?? null, JSON.stringify(data), ttlSeconds);
}

export function cleanExpiredCache(): number {
  const database = getDb();
  const result = database
    .prepare(`
      DELETE FROM token_cache
      WHERE datetime(fetched_at, '+' || ttl_seconds || ' seconds') < datetime('now')
    `)
    .run();
  return result.changes;
}

// ============ Provider State Operations ============

export function getProviderState(key: string): string | null {
  const database = getDb();
  const row = database
    .prepare('SELECT value FROM provider_state WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setProviderState(key: string, value: string): void {
  const database = getDb();
  database
    .prepare('INSERT OR REPLACE INTO provider_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
    .run(key, value);
}
