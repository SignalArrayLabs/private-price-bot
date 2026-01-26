import { describe, it, expect } from 'vitest';
import {
  parsePriceArgs,
  parseAlertAddArgs,
  parseAlertRemoveArgs,
  parseCallArgs,
  parseWatchArgs,
  parseSetDefaultArgs,
  parseScanArgs,
  isAddress,
  normalizeChain,
} from '../../src/utils/validation.js';

describe('Validation Utils', () => {
  describe('isAddress', () => {
    it('returns true for valid EVM address', () => {
      expect(isAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    });

    it('returns false for invalid addresses', () => {
      expect(isAddress('0x123')).toBe(false);
      expect(isAddress('not-an-address')).toBe(false);
      expect(isAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
    });
  });

  describe('normalizeChain', () => {
    it('normalizes ethereum aliases', () => {
      expect(normalizeChain('ethereum')).toBe('ethereum');
      expect(normalizeChain('eth')).toBe('ethereum');
      expect(normalizeChain('mainnet')).toBe('ethereum');
    });

    it('normalizes bsc aliases', () => {
      expect(normalizeChain('bsc')).toBe('bsc');
      expect(normalizeChain('bnb')).toBe('bsc');
      expect(normalizeChain('binance')).toBe('bsc');
    });

    it('normalizes polygon aliases', () => {
      expect(normalizeChain('polygon')).toBe('polygon');
      expect(normalizeChain('matic')).toBe('polygon');
    });

    it('returns null for unknown chains', () => {
      expect(normalizeChain('unknown')).toBe(null);
    });
  });

  describe('parsePriceArgs', () => {
    it('parses symbol only', () => {
      const result = parsePriceArgs(['BTC']);
      expect(result).toEqual({
        symbolOrAddress: 'BTC',
        chain: undefined,
      });
    });

    it('parses symbol with chain', () => {
      const result = parsePriceArgs(['ETH', 'ethereum']);
      expect(result).toEqual({
        symbolOrAddress: 'ETH',
        chain: 'ethereum',
      });
    });

    it('parses address with chain', () => {
      const result = parsePriceArgs(['0x1234567890abcdef1234567890abcdef12345678', 'bsc']);
      expect(result).toEqual({
        symbolOrAddress: '0x1234567890abcdef1234567890abcdef12345678',
        chain: 'bsc',
      });
    });

    it('returns null for empty args', () => {
      expect(parsePriceArgs([])).toBe(null);
    });

    it('returns null for invalid input', () => {
      expect(parsePriceArgs(['invalid$symbol'])).toBe(null);
    });
  });

  describe('parseAlertAddArgs', () => {
    it('parses complete alert add command', () => {
      const result = parseAlertAddArgs(['add', 'BTC', 'above', '70000']);
      expect(result).toEqual({
        symbol: 'BTC',
        direction: 'above',
        targetPrice: 70000,
        cooldownMinutes: undefined,
      });
    });

    it('parses alert with cooldown', () => {
      const result = parseAlertAddArgs(['add', 'ETH', 'below', '3000', '30']);
      expect(result).toEqual({
        symbol: 'ETH',
        direction: 'below',
        targetPrice: 3000,
        cooldownMinutes: 30,
      });
    });

    it('handles price with dollar sign and commas', () => {
      const result = parseAlertAddArgs(['add', 'BTC', 'above', '$70,000']);
      expect(result).toEqual({
        symbol: 'BTC',
        direction: 'above',
        targetPrice: 70000,
        cooldownMinutes: undefined,
      });
    });

    it('returns null for invalid direction', () => {
      expect(parseAlertAddArgs(['add', 'BTC', 'up', '70000'])).toBe(null);
    });

    it('returns null for missing args', () => {
      expect(parseAlertAddArgs(['add', 'BTC'])).toBe(null);
    });
  });

  describe('parseAlertRemoveArgs', () => {
    it('parses valid remove command', () => {
      const result = parseAlertRemoveArgs(['remove', '42']);
      expect(result).toEqual({ alertId: 42 });
    });

    it('returns null for invalid id', () => {
      expect(parseAlertRemoveArgs(['remove', 'abc'])).toBe(null);
    });

    it('returns null for missing id', () => {
      expect(parseAlertRemoveArgs(['remove'])).toBe(null);
    });
  });

  describe('parseCallArgs', () => {
    it('parses symbol only', () => {
      const result = parseCallArgs(['PEPE']);
      expect(result).toEqual({
        symbolOrAddress: 'PEPE',
        entryPrice: undefined,
        notes: undefined,
      });
    });

    it('parses symbol with price', () => {
      const result = parseCallArgs(['BTC', '67000']);
      expect(result).toEqual({
        symbolOrAddress: 'BTC',
        entryPrice: 67000,
        notes: undefined,
      });
    });

    it('parses symbol with price and notes', () => {
      const result = parseCallArgs(['BTC', '67000', 'Looking', 'bullish']);
      expect(result).toEqual({
        symbolOrAddress: 'BTC',
        entryPrice: 67000,
        notes: 'Looking bullish',
      });
    });

    it('parses symbol with notes only (no numeric price)', () => {
      const result = parseCallArgs(['BTC', 'Looking', 'bullish']);
      expect(result).toEqual({
        symbolOrAddress: 'BTC',
        entryPrice: undefined,
        notes: 'Looking bullish',
      });
    });
  });

  describe('parseWatchArgs', () => {
    it('parses list action', () => {
      const result = parseWatchArgs(['list']);
      expect(result).toEqual({ action: 'list' });
    });

    it('defaults to list with no args', () => {
      const result = parseWatchArgs([]);
      expect(result).toEqual({ action: 'list' });
    });

    it('parses add action', () => {
      const result = parseWatchArgs(['add', 'BTC']);
      expect(result).toEqual({
        action: 'add',
        symbolOrAddress: 'BTC',
        chain: undefined,
      });
    });

    it('parses remove action with chain', () => {
      const result = parseWatchArgs(['remove', 'ETH', 'ethereum']);
      expect(result).toEqual({
        action: 'remove',
        symbolOrAddress: 'ETH',
        chain: 'ethereum',
      });
    });
  });

  describe('parseScanArgs', () => {
    it('parses address with default chain', () => {
      const result = parseScanArgs(['0x1234567890abcdef1234567890abcdef12345678']);
      expect(result).toEqual({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chain: 'ethereum',
      });
    });

    it('parses address with specified chain', () => {
      const result = parseScanArgs(['0x1234567890abcdef1234567890abcdef12345678', 'bsc']);
      expect(result).toEqual({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chain: 'bsc',
      });
    });

    it('returns null for invalid address', () => {
      expect(parseScanArgs(['not-an-address'])).toBe(null);
    });
  });
});
