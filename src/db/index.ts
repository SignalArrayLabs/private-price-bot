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
  AuthorizedUser,
  PaymentTransaction,
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
  chain?: SupportedChain
): Call {
  const database = getDb();
  const result = database
    .prepare(`
      INSERT INTO calls (group_id, user_id, token_ref, chain, call_price)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(groupId, userId, tokenRef.toLowerCase(), chain ?? null, callPrice);

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

// ============ Authorization Operations ============

export type AuthorizationType = 'stripe_card' | 'stripe_crypto' | 'manual';

export function isUserAuthorized(tgUserId: number): boolean {
  const database = getDb();
  const row = database
    .prepare('SELECT id FROM authorized_users WHERE tg_user_id = ?')
    .get(tgUserId);
  return row !== undefined;
}

export function getAuthorizedUser(tgUserId: number): AuthorizedUser | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM authorized_users WHERE tg_user_id = ?')
    .get(tgUserId) as {
      id: number;
      tg_user_id: number;
      username: string | null;
      authorization_type: string;
      stripe_payment_id: string | null;
      amount_paid: number | null;
      authorized_at: string;
      authorized_by: number | null;
      notes: string | null;
    } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    tgUserId: row.tg_user_id,
    username: row.username ?? undefined,
    authorizationType: row.authorization_type as AuthorizationType,
    stripePaymentId: row.stripe_payment_id ?? undefined,
    amountPaid: row.amount_paid ?? undefined,
    authorizedAt: new Date(row.authorized_at),
    authorizedBy: row.authorized_by ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function authorizeUser(
  tgUserId: number,
  authorizationType: AuthorizationType,
  options?: {
    username?: string;
    stripePaymentId?: string;
    amountPaid?: number;
    authorizedBy?: number;
    notes?: string;
  }
): AuthorizedUser {
  const database = getDb();

  // Check if already authorized
  const existing = getAuthorizedUser(tgUserId);
  if (existing) {
    return existing;
  }

  const result = database
    .prepare(`
      INSERT INTO authorized_users (tg_user_id, username, authorization_type, stripe_payment_id, amount_paid, authorized_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      tgUserId,
      options?.username ?? null,
      authorizationType,
      options?.stripePaymentId ?? null,
      options?.amountPaid ?? null,
      options?.authorizedBy ?? null,
      options?.notes ?? null
    );

  return {
    id: result.lastInsertRowid as number,
    tgUserId,
    username: options?.username,
    authorizationType,
    stripePaymentId: options?.stripePaymentId,
    amountPaid: options?.amountPaid,
    authorizedAt: new Date(),
    authorizedBy: options?.authorizedBy,
    notes: options?.notes,
  };
}

export function revokeUserAuthorization(tgUserId: number): boolean {
  const database = getDb();
  const result = database
    .prepare('DELETE FROM authorized_users WHERE tg_user_id = ?')
    .run(tgUserId);
  return result.changes > 0;
}

export function getAllAuthorizedUsers(): AuthorizedUser[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM authorized_users ORDER BY authorized_at DESC')
    .all() as Array<{
      id: number;
      tg_user_id: number;
      username: string | null;
      authorization_type: string;
      stripe_payment_id: string | null;
      amount_paid: number | null;
      authorized_at: string;
      authorized_by: number | null;
      notes: string | null;
    }>;

  return rows.map(row => ({
    id: row.id,
    tgUserId: row.tg_user_id,
    username: row.username ?? undefined,
    authorizationType: row.authorization_type as AuthorizationType,
    stripePaymentId: row.stripe_payment_id ?? undefined,
    amountPaid: row.amount_paid ?? undefined,
    authorizedAt: new Date(row.authorized_at),
    authorizedBy: row.authorized_by ?? undefined,
    notes: row.notes ?? undefined,
  }));
}

export function getAuthorizationStats(): {
  total: number;
  byType: Record<AuthorizationType, number>;
} {
  const database = getDb();

  const total = (database
    .prepare('SELECT COUNT(*) as count FROM authorized_users')
    .get() as { count: number }).count;

  const byTypeRows = database
    .prepare('SELECT authorization_type, COUNT(*) as count FROM authorized_users GROUP BY authorization_type')
    .all() as Array<{ authorization_type: string; count: number }>;

  const byType: Record<AuthorizationType, number> = {
    stripe_card: 0,
    stripe_crypto: 0,
    manual: 0,
  };

  byTypeRows.forEach(row => {
    byType[row.authorization_type as AuthorizationType] = row.count;
  });

  return { total, byType };
}

// ============ Payment Transaction Operations ============

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'expired';

export function createPaymentTransaction(
  tgUserId: number,
  stripeSessionId: string,
  amount: number,
  currency = 'usd'
): PaymentTransaction {
  const database = getDb();

  const result = database
    .prepare(`
      INSERT INTO payment_transactions (tg_user_id, stripe_session_id, amount, currency, status)
      VALUES (?, ?, ?, ?, 'pending')
    `)
    .run(tgUserId, stripeSessionId, amount, currency);

  return {
    id: result.lastInsertRowid as number,
    tgUserId,
    stripeSessionId,
    amount,
    currency,
    status: 'pending',
    createdAt: new Date(),
  };
}

export function updatePaymentTransaction(
  stripeSessionId: string,
  status: PaymentStatus,
  options?: {
    stripePaymentIntentId?: string;
    paymentMethod?: string;
  }
): boolean {
  const database = getDb();

  const completedAt = status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL';

  const result = database
    .prepare(`
      UPDATE payment_transactions
      SET status = ?,
          stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
          payment_method = COALESCE(?, payment_method),
          completed_at = ${completedAt === 'CURRENT_TIMESTAMP' ? 'CURRENT_TIMESTAMP' : 'completed_at'}
      WHERE stripe_session_id = ?
    `)
    .run(status, options?.stripePaymentIntentId ?? null, options?.paymentMethod ?? null, stripeSessionId);

  return result.changes > 0;
}

export function getPaymentTransaction(stripeSessionId: string): PaymentTransaction | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM payment_transactions WHERE stripe_session_id = ?')
    .get(stripeSessionId) as {
      id: number;
      tg_user_id: number;
      stripe_session_id: string;
      stripe_payment_intent_id: string | null;
      payment_method: string | null;
      amount: number;
      currency: string;
      status: string;
      created_at: string;
      completed_at: string | null;
    } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    tgUserId: row.tg_user_id,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    amount: row.amount,
    currency: row.currency,
    status: row.status as PaymentStatus,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

export function getRecentPayments(limit = 20): PaymentTransaction[] {
  const database = getDb();
  const rows = database
    .prepare(`
      SELECT pt.*, au.username
      FROM payment_transactions pt
      LEFT JOIN authorized_users au ON pt.tg_user_id = au.tg_user_id
      ORDER BY pt.created_at DESC
      LIMIT ?
    `)
    .all(limit) as Array<{
      id: number;
      tg_user_id: number;
      stripe_session_id: string;
      stripe_payment_intent_id: string | null;
      payment_method: string | null;
      amount: number;
      currency: string;
      status: string;
      created_at: string;
      completed_at: string | null;
      username: string | null;
    }>;

  return rows.map(row => ({
    id: row.id,
    tgUserId: row.tg_user_id,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    amount: row.amount,
    currency: row.currency,
    status: row.status as PaymentStatus,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    username: row.username ?? undefined,
  }));
}

export function getPaymentStats(): {
  total: number;
  completed: number;
  totalRevenue: number;
  byMethod: Record<string, number>;
} {
  const database = getDb();

  const statsRow = database
    .prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue
      FROM payment_transactions
    `)
    .get() as { total: number; completed: number; total_revenue: number };

  const byMethodRows = database
    .prepare(`
      SELECT payment_method, COUNT(*) as count
      FROM payment_transactions
      WHERE status = 'completed' AND payment_method IS NOT NULL
      GROUP BY payment_method
    `)
    .all() as Array<{ payment_method: string; count: number }>;

  const byMethod: Record<string, number> = {};
  byMethodRows.forEach(row => {
    byMethod[row.payment_method] = row.count;
  });

  return {
    total: statsRow.total,
    completed: statsRow.completed,
    totalRevenue: statsRow.total_revenue,
    byMethod,
  };
}
