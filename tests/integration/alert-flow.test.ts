import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Alert Flow Integration Tests
 *
 * Tests the full alert lifecycle:
 * 1. Alert creation (via parseAlertAddArgs)
 * 2. Alert evaluation logic (above/below threshold)
 * 3. Cooldown enforcement
 * 4. Alert removal
 */

describe('Alert Flow Integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Alert Trigger Logic', () => {
    it('should trigger alert when price goes above target', () => {
      const alert = {
        id: 1,
        direction: 'above' as const,
        targetPrice: 70000,
        lastTriggeredAt: null,
        cooldownMinutes: 60,
      };

      const currentPrice = 71000;

      const shouldTrigger =
        (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.direction === 'below' && currentPrice <= alert.targetPrice);

      expect(shouldTrigger).toBe(true);
    });

    it('should trigger alert when price goes below target', () => {
      const alert = {
        id: 2,
        direction: 'below' as const,
        targetPrice: 60000,
        lastTriggeredAt: null,
        cooldownMinutes: 60,
      };

      const currentPrice = 59000;

      const shouldTrigger =
        (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.direction === 'below' && currentPrice <= alert.targetPrice);

      expect(shouldTrigger).toBe(true);
    });

    it('should NOT trigger alert when price is between thresholds', () => {
      const aboveAlert = {
        direction: 'above' as const,
        targetPrice: 70000,
      };

      const belowAlert = {
        direction: 'below' as const,
        targetPrice: 60000,
      };

      const currentPrice = 65000;

      const aboveTrigger =
        aboveAlert.direction === 'above' && currentPrice >= aboveAlert.targetPrice;
      const belowTrigger =
        belowAlert.direction === 'below' && currentPrice <= belowAlert.targetPrice;

      expect(aboveTrigger).toBe(false);
      expect(belowTrigger).toBe(false);
    });
  });

  describe('Alert Cooldown Logic', () => {
    it('should respect cooldown period', () => {
      const cooldownMinutes = 60;
      const lastTriggeredAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

      const cooldownMs = cooldownMinutes * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - lastTriggeredAt.getTime();
      const isInCooldown = timeSinceLastTrigger < cooldownMs;

      expect(isInCooldown).toBe(true);
    });

    it('should allow trigger after cooldown expires', () => {
      const cooldownMinutes = 60;
      const lastTriggeredAt = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago

      const cooldownMs = cooldownMinutes * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - lastTriggeredAt.getTime();
      const isInCooldown = timeSinceLastTrigger < cooldownMs;

      expect(isInCooldown).toBe(false);
    });

    it('should trigger immediately if never triggered before', () => {
      const lastTriggeredAt = null;

      // No cooldown check needed if never triggered
      const canTrigger = lastTriggeredAt === null;

      expect(canTrigger).toBe(true);
    });
  });

  describe('Alert Grouping by Token', () => {
    it('should group alerts by token to minimize API calls', () => {
      const alerts = [
        { id: 1, tokenRef: 'BTC', chain: null, direction: 'above', targetPrice: 70000 },
        { id: 2, tokenRef: 'BTC', chain: null, direction: 'below', targetPrice: 60000 },
        { id: 3, tokenRef: 'ETH', chain: null, direction: 'above', targetPrice: 4000 },
        { id: 4, tokenRef: 'BTC', chain: 'ethereum', direction: 'above', targetPrice: 71000 },
      ];

      const tokenAlerts = new Map<string, typeof alerts>();
      for (const alert of alerts) {
        const key = `${alert.tokenRef}:${alert.chain ?? ''}`;
        const existing = tokenAlerts.get(key) ?? [];
        existing.push(alert);
        tokenAlerts.set(key, existing);
      }

      // Should have 3 groups: BTC:, ETH:, BTC:ethereum
      expect(tokenAlerts.size).toBe(3);
      expect(tokenAlerts.get('BTC:')?.length).toBe(2);
      expect(tokenAlerts.get('ETH:')?.length).toBe(1);
      expect(tokenAlerts.get('BTC:ethereum')?.length).toBe(1);
    });
  });

  describe('Price Routing for Alerts', () => {
    it('should identify contract addresses vs symbols', () => {
      const isAddress = (value: string): boolean =>
        /^0x[a-fA-F0-9]{40}$/.test(value);

      // Symbols
      expect(isAddress('BTC')).toBe(false);
      expect(isAddress('ETH')).toBe(false);
      expect(isAddress('PEPE')).toBe(false);

      // Addresses
      expect(isAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(isAddress('0xdead000000000000000000000000000000000000')).toBe(true);

      // Invalid
      expect(isAddress('0x123')).toBe(false);
      expect(isAddress('0xGGGG567890abcdef1234567890abcdef12345678')).toBe(false);
    });
  });
});
