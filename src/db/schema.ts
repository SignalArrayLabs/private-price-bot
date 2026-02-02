// SQLite schema definitions
// Note: This bot stores ONLY command data and derived stats, NOT message content

export const SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = `
-- Groups table: stores group configuration
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_chat_id INTEGER UNIQUE NOT NULL,
  title TEXT,
  default_token TEXT,
  default_chain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table: stores user IDs for leaderboard (no message content)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_user_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist table: tokens being watched per group
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  token_ref TEXT NOT NULL,
  chain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(group_id, token_ref, chain)
);

-- Alerts table: price alerts per group
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  token_ref TEXT NOT NULL,
  chain TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  target_price REAL NOT NULL,
  cooldown_minutes INTEGER DEFAULT 60,
  last_triggered_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Calls table: token calls for leaderboard tracking
CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  token_ref TEXT NOT NULL,
  chain TEXT,
  call_price REAL NOT NULL,
  call_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Token cache table: cached price and metadata
CREATE TABLE IF NOT EXISTS token_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_ref TEXT NOT NULL,
  chain TEXT,
  data_json TEXT NOT NULL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ttl_seconds INTEGER DEFAULT 30,
  UNIQUE(token_ref, chain)
);

-- Provider state table: tracks provider health and fallback state
CREATE TABLE IF NOT EXISTS provider_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_tg_chat_id ON groups(tg_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_tg_user_id ON users(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_group ON watchlist(group_id);
CREATE INDEX IF NOT EXISTS idx_alerts_group ON alerts(group_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_calls_group ON calls(group_id);
CREATE INDEX IF NOT EXISTS idx_calls_user ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_token ON calls(token_ref);
CREATE INDEX IF NOT EXISTS idx_token_cache_ref ON token_cache(token_ref, chain);
CREATE INDEX IF NOT EXISTS idx_token_cache_fetched ON token_cache(fetched_at);
`;

// Migration 2: Add authorized_users and payment_transactions tables
export const MIGRATION_2_ACCESS_CONTROL = `
-- Authorized users table: tracks who has access to the bot
CREATE TABLE IF NOT EXISTS authorized_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_user_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  authorization_type TEXT NOT NULL CHECK (authorization_type IN ('stripe_card', 'stripe_crypto', 'manual')),
  stripe_payment_id TEXT,
  amount_paid REAL,
  authorized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  authorized_by INTEGER,
  notes TEXT
);

-- Payment transactions table: tracks all payment attempts and completions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_user_id INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  payment_method TEXT,
  amount REAL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_authorized_users_tg_user_id ON authorized_users(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_authorized_users_type ON authorized_users(authorization_type);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tg_user_id ON payment_transactions(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_session ON payment_transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
`;

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: CREATE_TABLES_SQL,
  },
  {
    version: 2,
    sql: MIGRATION_2_ACCESS_CONTROL,
  },
];
