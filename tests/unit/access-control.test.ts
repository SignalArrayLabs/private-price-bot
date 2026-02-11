import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { dirname } from 'path';

// Test database path
const TEST_DB_PATH = './data/test-access.db';

describe('Access Control Database Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create test database
    const dbDir = dirname(TEST_DB_PATH);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
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
    `);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    if (existsSync(TEST_DB_PATH + '-wal')) {
      rmSync(TEST_DB_PATH + '-wal');
    }
    if (existsSync(TEST_DB_PATH + '-shm')) {
      rmSync(TEST_DB_PATH + '-shm');
    }
  });

  describe('User Authorization', () => {
    it('should authorize a user manually', () => {
      const stmt = db.prepare(`
        INSERT INTO authorized_users (tg_user_id, username, authorization_type, authorized_by, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(123456789, 'testuser', 'manual', 111111111, 'Test approval');

      expect(result.lastInsertRowid).toBeGreaterThan(0);

      const user = db.prepare('SELECT * FROM authorized_users WHERE tg_user_id = ?').get(123456789) as any;
      expect(user).toBeDefined();
      expect(user.tg_user_id).toBe(123456789);
      expect(user.username).toBe('testuser');
      expect(user.authorization_type).toBe('manual');
      expect(user.authorized_by).toBe(111111111);
    });

    it('should authorize a user via Stripe card payment', () => {
      const stmt = db.prepare(`
        INSERT INTO authorized_users (tg_user_id, authorization_type, stripe_payment_id, amount_paid)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(123456789, 'stripe_card', 'pi_test123', 29.99);

      const user = db.prepare('SELECT * FROM authorized_users WHERE tg_user_id = ?').get(123456789) as any;
      expect(user.authorization_type).toBe('stripe_card');
      expect(user.stripe_payment_id).toBe('pi_test123');
      expect(user.amount_paid).toBe(29.99);
    });

    it('should authorize a user via Stripe crypto payment', () => {
      const stmt = db.prepare(`
        INSERT INTO authorized_users (tg_user_id, authorization_type, stripe_payment_id, amount_paid)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(123456789, 'stripe_crypto', 'pi_crypto123', 29.99);

      const user = db.prepare('SELECT * FROM authorized_users WHERE tg_user_id = ?').get(123456789) as any;
      expect(user.authorization_type).toBe('stripe_crypto');
    });

    it('should check if user is authorized', () => {
      // User not authorized
      let user = db.prepare('SELECT id FROM authorized_users WHERE tg_user_id = ?').get(123456789);
      expect(user).toBeUndefined();

      // Authorize user
      db.prepare('INSERT INTO authorized_users (tg_user_id, authorization_type) VALUES (?, ?)').run(123456789, 'manual');

      // User now authorized
      user = db.prepare('SELECT id FROM authorized_users WHERE tg_user_id = ?').get(123456789);
      expect(user).toBeDefined();
    });

    it('should revoke user authorization', () => {
      // Authorize user
      db.prepare('INSERT INTO authorized_users (tg_user_id, authorization_type) VALUES (?, ?)').run(123456789, 'manual');

      // Revoke access
      const result = db.prepare('DELETE FROM authorized_users WHERE tg_user_id = ?').run(123456789);
      expect(result.changes).toBe(1);

      // User no longer authorized
      const user = db.prepare('SELECT id FROM authorized_users WHERE tg_user_id = ?').get(123456789);
      expect(user).toBeUndefined();
    });

    it('should enforce unique user constraint', () => {
      db.prepare('INSERT INTO authorized_users (tg_user_id, authorization_type) VALUES (?, ?)').run(123456789, 'manual');

      expect(() => {
        db.prepare('INSERT INTO authorized_users (tg_user_id, authorization_type) VALUES (?, ?)').run(123456789, 'stripe_card');
      }).toThrow();
    });

    it('should reject invalid authorization types', () => {
      expect(() => {
        db.prepare('INSERT INTO authorized_users (tg_user_id, authorization_type) VALUES (?, ?)').run(123456789, 'invalid_type');
      }).toThrow();
    });
  });

  describe('Payment Transactions', () => {
    it('should create a pending payment transaction', () => {
      const stmt = db.prepare(`
        INSERT INTO payment_transactions (tg_user_id, stripe_session_id, amount, status)
        VALUES (?, ?, ?, 'pending')
      `);
      stmt.run(123456789, 'cs_test123', 29.99);

      const tx = db.prepare('SELECT * FROM payment_transactions WHERE stripe_session_id = ?').get('cs_test123') as any;
      expect(tx).toBeDefined();
      expect(tx.status).toBe('pending');
      expect(tx.amount).toBe(29.99);
    });

    it('should update payment status to completed', () => {
      db.prepare(`
        INSERT INTO payment_transactions (tg_user_id, stripe_session_id, amount, status)
        VALUES (?, ?, ?, 'pending')
      `).run(123456789, 'cs_test123', 29.99);

      db.prepare(`
        UPDATE payment_transactions
        SET status = 'completed', payment_method = ?, completed_at = CURRENT_TIMESTAMP
        WHERE stripe_session_id = ?
      `).run('card', 'cs_test123');

      const tx = db.prepare('SELECT * FROM payment_transactions WHERE stripe_session_id = ?').get('cs_test123') as any;
      expect(tx.status).toBe('completed');
      expect(tx.payment_method).toBe('card');
      expect(tx.completed_at).toBeDefined();
    });

    it('should track payment statistics', () => {
      // Add some test transactions
      const insert = db.prepare(`
        INSERT INTO payment_transactions (tg_user_id, stripe_session_id, amount, status, payment_method)
        VALUES (?, ?, ?, ?, ?)
      `);

      insert.run(1, 'cs_1', 29.99, 'completed', 'card');
      insert.run(2, 'cs_2', 29.99, 'completed', 'card');
      insert.run(3, 'cs_3', 29.99, 'completed', 'crypto');
      insert.run(4, 'cs_4', 29.99, 'pending', null);
      insert.run(5, 'cs_5', 29.99, 'failed', null);

      const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue
        FROM payment_transactions
      `).get() as any;

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(3);
      expect(stats.total_revenue).toBeCloseTo(89.97, 2);

      const byMethod = db.prepare(`
        SELECT payment_method, COUNT(*) as count
        FROM payment_transactions
        WHERE status = 'completed' AND payment_method IS NOT NULL
        GROUP BY payment_method
      `).all() as any[];

      const methodCounts = byMethod.reduce((acc, row) => {
        acc[row.payment_method] = row.count;
        return acc;
      }, {} as Record<string, number>);

      expect(methodCounts['card']).toBe(2);
      expect(methodCounts['crypto']).toBe(1);
    });
  });

  describe('Authorization Statistics', () => {
    it('should track authorization stats by type', () => {
      const insert = db.prepare('INSERT INTO authorized_users (tg_user_id, authorization_type) VALUES (?, ?)');

      insert.run(1, 'manual');
      insert.run(2, 'manual');
      insert.run(3, 'stripe_card');
      insert.run(4, 'stripe_card');
      insert.run(5, 'stripe_card');
      insert.run(6, 'stripe_crypto');

      const stats = db.prepare(`
        SELECT authorization_type, COUNT(*) as count
        FROM authorized_users
        GROUP BY authorization_type
      `).all() as any[];

      const typeCounts = stats.reduce((acc, row) => {
        acc[row.authorization_type] = row.count;
        return acc;
      }, {} as Record<string, number>);

      expect(typeCounts['manual']).toBe(2);
      expect(typeCounts['stripe_card']).toBe(3);
      expect(typeCounts['stripe_crypto']).toBe(1);

      const total = db.prepare('SELECT COUNT(*) as count FROM authorized_users').get() as any;
      expect(total.count).toBe(6);
    });
  });
});

describe('Access Control Logic', () => {
  const PUBLIC_COMMANDS = new Set(['start', 'help', 'privacy']);
  const ADMIN_COMMANDS = new Set(['approve', 'revoke', 'users', 'listusers', 'checkuser', 'payments']);

  function isPublicCommand(command: string): boolean {
    return PUBLIC_COMMANDS.has(command);
  }

  function isAdminCommand(command: string): boolean {
    return ADMIN_COMMANDS.has(command);
  }

  function isAdmin(userId: number, adminId: number | undefined): boolean {
    return adminId !== undefined && userId === adminId;
  }

  describe('Public Commands', () => {
    it('should identify public commands', () => {
      expect(isPublicCommand('start')).toBe(true);
      expect(isPublicCommand('help')).toBe(true);
      expect(isPublicCommand('privacy')).toBe(true);
      expect(isPublicCommand('price')).toBe(false);
      expect(isPublicCommand('approve')).toBe(false);
    });
  });

  describe('Admin Commands', () => {
    it('should identify admin commands', () => {
      expect(isAdminCommand('approve')).toBe(true);
      expect(isAdminCommand('revoke')).toBe(true);
      expect(isAdminCommand('listusers')).toBe(true);
      expect(isAdminCommand('checkuser')).toBe(true);
      expect(isAdminCommand('payments')).toBe(true);
      expect(isAdminCommand('price')).toBe(false);
      expect(isAdminCommand('help')).toBe(false);
    });
  });

  describe('Admin Check', () => {
    it('should identify admin user', () => {
      expect(isAdmin(123456, 123456)).toBe(true);
      expect(isAdmin(123456, 654321)).toBe(false);
      expect(isAdmin(123456, undefined)).toBe(false);
    });
  });

  describe('Access Decision Logic', () => {
    function shouldAllowAccess(
      command: string,
      userId: number,
      adminId: number | undefined,
      isAuthorized: boolean
    ): { allowed: boolean; reason: string } {
      // Admin always has access
      if (isAdmin(userId, adminId)) {
        return { allowed: true, reason: 'admin' };
      }

      // Admin commands are restricted
      if (isAdminCommand(command)) {
        return { allowed: false, reason: 'admin_only' };
      }

      // Public commands are always allowed
      if (isPublicCommand(command)) {
        return { allowed: true, reason: 'public' };
      }

      // Other commands require authorization
      if (isAuthorized) {
        return { allowed: true, reason: 'authorized' };
      }

      return { allowed: false, reason: 'not_authorized' };
    }

    it('should allow admin to use any command', () => {
      const adminId = 123456;
      expect(shouldAllowAccess('price', adminId, adminId, false).allowed).toBe(true);
      expect(shouldAllowAccess('approve', adminId, adminId, false).allowed).toBe(true);
      expect(shouldAllowAccess('help', adminId, adminId, false).allowed).toBe(true);
    });

    it('should block admin commands for non-admins', () => {
      const result = shouldAllowAccess('approve', 999, 123456, true);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('admin_only');
    });

    it('should allow public commands for everyone', () => {
      expect(shouldAllowAccess('help', 999, 123456, false).allowed).toBe(true);
      expect(shouldAllowAccess('start', 999, 123456, false).allowed).toBe(true);
      expect(shouldAllowAccess('privacy', 999, 123456, false).allowed).toBe(true);
    });

    it('should allow authorized users to use regular commands', () => {
      const result = shouldAllowAccess('price', 999, 123456, true);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('authorized');
    });

    it('should block unauthorized users from regular commands', () => {
      const result = shouldAllowAccess('price', 999, 123456, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('not_authorized');
    });
  });
});
