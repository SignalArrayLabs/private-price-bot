import { describe, it, expect } from 'vitest';
import {
  escapeMarkdownV2,
  formatPrice,
  formatLargeNumber,
  formatPercentage,
  formatTimeAgo,
  truncateAddress,
  generateSparkline,
} from '../../src/utils/format.js';

describe('Format Utils', () => {
  describe('escapeMarkdownV2', () => {
    it('escapes underscore', () => {
      expect(escapeMarkdownV2('hello_world')).toBe('hello\\_world');
    });

    it('escapes asterisk', () => {
      expect(escapeMarkdownV2('*bold*')).toBe('\\*bold\\*');
    });

    it('escapes brackets', () => {
      expect(escapeMarkdownV2('[link](url)')).toBe('\\[link\\]\\(url\\)');
    });

    it('escapes dot', () => {
      expect(escapeMarkdownV2('100.50')).toBe('100\\.50');
    });

    it('escapes multiple characters', () => {
      expect(escapeMarkdownV2('hello_world *test* [link]')).toBe('hello\\_world \\*test\\* \\[link\\]');
    });
  });

  describe('formatPrice', () => {
    it('formats large prices with 2 decimals', () => {
      expect(formatPrice(67234.56)).toMatch(/67,?234\.56/);
    });

    it('formats medium prices with more decimals', () => {
      const result = formatPrice(3.5678);
      expect(result).toContain('3.56');
    });

    it('formats small prices with many decimals', () => {
      const result = formatPrice(0.00001234);
      expect(result).toContain('0.0000');
    });

    it('formats very small prices', () => {
      const result = formatPrice(0.000000001234);
      expect(result.length).toBeGreaterThan(8);
    });
  });

  describe('formatLargeNumber', () => {
    it('formats trillions', () => {
      expect(formatLargeNumber(1.5e12)).toBe('1.50T');
    });

    it('formats billions', () => {
      expect(formatLargeNumber(28.5e9)).toBe('28.50B');
    });

    it('formats millions', () => {
      expect(formatLargeNumber(1.5e6)).toBe('1.50M');
    });

    it('formats thousands', () => {
      expect(formatLargeNumber(5500)).toBe('5.50K');
    });

    it('formats small numbers without suffix', () => {
      const result = formatLargeNumber(500);
      expect(result).toBe('500');
    });
  });

  describe('formatPercentage', () => {
    it('formats positive percentage with plus', () => {
      expect(formatPercentage(5.67)).toBe('+5.67%');
    });

    it('formats negative percentage', () => {
      expect(formatPercentage(-3.21)).toBe('-3.21%');
    });

    it('formats zero', () => {
      expect(formatPercentage(0)).toBe('+0.00%');
    });
  });

  describe('formatTimeAgo', () => {
    it('formats seconds ago', () => {
      const date = new Date(Date.now() - 30 * 1000);
      expect(formatTimeAgo(date)).toBe('30 seconds ago');
    });

    it('formats 1 second ago', () => {
      const date = new Date(Date.now() - 1000);
      expect(formatTimeAgo(date)).toBe('1 second ago');
    });

    it('formats minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatTimeAgo(date)).toBe('5 minutes ago');
    });

    it('formats 1 minute ago', () => {
      const date = new Date(Date.now() - 60 * 1000);
      expect(formatTimeAgo(date)).toBe('1 minute ago');
    });

    it('formats hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatTimeAgo(date)).toBe('3 hours ago');
    });

    it('formats days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatTimeAgo(date)).toBe('2 days ago');
    });
  });

  describe('truncateAddress', () => {
    it('truncates long address', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      expect(truncateAddress(address)).toBe('0x1234...5678');
    });

    it('keeps short string unchanged', () => {
      expect(truncateAddress('0x12345678')).toBe('0x12345678');
    });
  });

  describe('generateSparkline', () => {
    it('generates sparkline from price array', () => {
      const prices = [100, 110, 105, 120, 115, 130, 125, 140];
      const result = generateSparkline(prices);
      expect(result.length).toBe(prices.length);
      expect(result).toMatch(/[▁▂▃▄▅▆▇█]+/);
    });

    it('returns empty string for single price', () => {
      expect(generateSparkline([100])).toBe('');
    });

    it('returns empty string for empty array', () => {
      expect(generateSparkline([])).toBe('');
    });
  });
});
