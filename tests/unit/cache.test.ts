import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

describe('Cache Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS token_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_ref TEXT NOT NULL,
        chain TEXT,
        data_json TEXT NOT NULL,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ttl_seconds INTEGER DEFAULT 30,
        UNIQUE(token_ref, chain)
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('should store and retrieve cached data', () => {
    const tokenRef = 'btc';
    const data = { symbol: 'BTC', price: 67000 };
    const ttl = 30;

    // Insert cache entry
    db.prepare(`
      INSERT OR REPLACE INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(tokenRef, null, JSON.stringify(data), ttl);

    // Retrieve cache entry
    const row = db.prepare(`
      SELECT data_json, fetched_at, ttl_seconds
      FROM token_cache
      WHERE token_ref = ? AND chain IS NULL
    `).get(tokenRef) as { data_json: string; fetched_at: string; ttl_seconds: number };

    expect(row).not.toBeUndefined();
    expect(JSON.parse(row.data_json)).toEqual(data);
    expect(row.ttl_seconds).toBe(ttl);
  });

  it('should handle chain-specific cache entries', () => {
    const tokenRef = '0x1234567890abcdef1234567890abcdef12345678';
    const chain = 'ethereum';
    const data = { symbol: 'TEST', price: 1.5 };

    // Insert cache entry with chain
    db.prepare(`
      INSERT OR REPLACE INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(tokenRef, chain, JSON.stringify(data), 60);

    // Retrieve with correct chain
    const row = db.prepare(`
      SELECT data_json
      FROM token_cache
      WHERE token_ref = ? AND chain = ?
    `).get(tokenRef, chain) as { data_json: string } | undefined;

    expect(row).not.toBeUndefined();
    expect(JSON.parse(row!.data_json)).toEqual(data);

    // Should not find with wrong chain
    const wrongChain = db.prepare(`
      SELECT data_json
      FROM token_cache
      WHERE token_ref = ? AND chain = ?
    `).get(tokenRef, 'bsc');

    expect(wrongChain).toBeUndefined();
  });

  it('should identify expired cache entries', () => {
    const tokenRef = 'expired';
    const data = { symbol: 'EXP', price: 100 };

    // Insert with past timestamp
    db.prepare(`
      INSERT OR REPLACE INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, datetime('now', '-60 seconds'), ?)
    `).run(tokenRef, null, JSON.stringify(data), 30);

    // Check if expired
    const expiredRows = db.prepare(`
      SELECT token_ref
      FROM token_cache
      WHERE datetime(fetched_at, '+' || ttl_seconds || ' seconds') < datetime('now')
    `).all();

    expect(expiredRows.length).toBe(1);
    expect((expiredRows[0] as { token_ref: string }).token_ref).toBe(tokenRef);
  });

  it('should clean expired cache entries', () => {
    // Insert expired entry
    db.prepare(`
      INSERT INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, datetime('now', '-120 seconds'), ?)
    `).run('expired1', null, '{}', 30);

    // Insert valid entry
    db.prepare(`
      INSERT INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run('valid1', null, '{}', 30);

    // Clean expired
    const result = db.prepare(`
      DELETE FROM token_cache
      WHERE datetime(fetched_at, '+' || ttl_seconds || ' seconds') < datetime('now')
    `).run();

    expect(result.changes).toBe(1);

    // Verify only valid entry remains
    const remaining = db.prepare('SELECT COUNT(*) as count FROM token_cache').get() as { count: number };
    expect(remaining.count).toBe(1);
  });

  it('should replace existing cache entry', () => {
    const tokenRef = 'btc';
    const chain = 'ethereum'; // Use non-null chain for unique constraint to work

    // Insert first entry
    db.prepare(`
      INSERT OR REPLACE INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(tokenRef, chain, JSON.stringify({ price: 60000 }), 30);

    // Insert updated entry - should replace due to UNIQUE constraint
    db.prepare(`
      INSERT OR REPLACE INTO token_cache (token_ref, chain, data_json, fetched_at, ttl_seconds)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(tokenRef, chain, JSON.stringify({ price: 67000 }), 30);

    // Should only have one entry
    const count = db.prepare('SELECT COUNT(*) as count FROM token_cache WHERE token_ref = ? AND chain = ?').get(tokenRef, chain) as { count: number };
    expect(count.count).toBe(1);

    // Should have updated price
    const row = db.prepare('SELECT data_json FROM token_cache WHERE token_ref = ? AND chain = ?').get(tokenRef, chain) as { data_json: string };
    expect(JSON.parse(row.data_json).price).toBe(67000);
  });
});
