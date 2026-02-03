import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOnChainGainers, getOnChainLosers } from '../../src/providers/movers/dexscreener.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const boostsFixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/dexscreener-token-boosts-sample.json'), 'utf-8'));
const pairsFixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/dexscreener-token-pairs-sample.json'), 'utf-8'));

describe('On-chain Movers Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getOnChainGainers', () => {
    it('returns non-empty list of gainers from DexScreener', async () => {
      // Create mock data that passes filters (MIN_LIQUIDITY=10000, MIN_VOLUME=5000, MIN_AGE=1hr)
      const mockBoosts = [{ tokenAddress: 'test_token_addr', chainId: 'ethereum' }];
      const mockPairs = {
        pairs: [
          {
            chainId: 'ethereum',
            baseToken: { address: 'test_token_addr', name: 'Test Token', symbol: 'TEST' },
            priceUsd: '1.5',
            priceChange: { h24: 25 },
            volume: { h24: 50000 }, // Passes MIN_VOLUME
            liquidity: { usd: 50000 }, // Passes MIN_LIQUIDITY
            marketCap: 1000000,
            pairCreatedAt: Date.now() - (2 * 60 * 60 * 1000), // 2 hours old (passes MIN_AGE)
          },
        ],
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('token-boosts')) {
          return { ok: true, json: async () => mockBoosts };
        } else if (url.includes('/dex/tokens/')) {
          return { ok: true, json: async () => mockPairs };
        }
        return { ok: false };
      });

      vi.stubGlobal('fetch', mockFetch);

      const result = await getOnChainGainers(5);

      // PROOF: Returns non-empty array
      expect(result.length).toBeGreaterThan(0);

      // PROOF: Contains actual token data
      result.forEach(token => {
        expect(token.symbol).toBeTruthy();
        expect(token.name).toBeTruthy();
        expect(token.price).toBeGreaterThanOrEqual(0);
        expect(typeof token.priceChangePercent24h).toBe('number');
        expect(token.volume24h).toBeGreaterThanOrEqual(0);
      });

      // PROOF: Calls DexScreener API (not CoinGecko)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('dexscreener.com'),
        expect.anything()
      );
    });

    it('filters out tokens with insufficient liquidity/volume', async () => {
      // Create mock data with one good token and one bad token
      const mockBoosts = [{
        tokenAddress: 'good_token',
        chainId: 'ethereum',
      }];

      const mockPairs = {
        pairs: [
          {
            chainId: 'ethereum',
            baseToken: { address: 'good_token', name: 'Good Token', symbol: 'GOOD' },
            priceUsd: '1.5',
            priceChange: { h24: 25 },
            volume: { h24: 50000 }, // Above minimum
            liquidity: { usd: 50000 }, // Above minimum
            marketCap: 1000000,
            pairCreatedAt: Date.now() - (2 * 60 * 60 * 1000), // 2 hours old
          },
          {
            chainId: 'ethereum',
            baseToken: { address: 'bad_token', name: 'Bad Token', symbol: 'BAD' },
            priceUsd: '0.001',
            priceChange: { h24: 100 },
            volume: { h24: 100 }, // Below minimum
            liquidity: { usd: 1000 }, // Below minimum
            marketCap: 10000,
            pairCreatedAt: Date.now() - (0.5 * 60 * 60 * 1000), // 30 min old (too new)
          },
        ],
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('token-boosts')) {
          return { ok: true, json: async () => mockBoosts };
        } else {
          return { ok: true, json: async () => mockPairs };
        }
      });

      vi.stubGlobal('fetch', mockFetch);

      const result = await getOnChainGainers(5);

      // Should only include the good token
      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('GOOD');
    });

    it('returns empty array when API fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await getOnChainGainers(5);
      expect(result).toEqual([]);
    });
  });

  describe('getOnChainLosers', () => {
    it('returns losers sorted by negative price change', async () => {
      const mockBoosts = [{ tokenAddress: 'test_token', chainId: 'ethereum' }];
      const mockPairs = {
        pairs: [
          {
            chainId: 'ethereum',
            baseToken: { address: 'test1', name: 'Token 1', symbol: 'TK1' },
            priceUsd: '1.0',
            priceChange: { h24: -10 }, // Loser
            volume: { h24: 50000 },
            liquidity: { usd: 50000 },
            marketCap: 1000000,
            pairCreatedAt: Date.now() - (2 * 60 * 60 * 1000),
          },
          {
            chainId: 'ethereum',
            baseToken: { address: 'test2', name: 'Token 2', symbol: 'TK2' },
            priceUsd: '2.0',
            priceChange: { h24: -25 }, // Bigger loser
            volume: { h24: 50000 },
            liquidity: { usd: 50000 },
            marketCap: 2000000,
            pairCreatedAt: Date.now() - (2 * 60 * 60 * 1000),
          },
        ],
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('token-boosts')) {
          return { ok: true, json: async () => mockBoosts };
        } else {
          return { ok: true, json: async () => mockPairs };
        }
      });

      vi.stubGlobal('fetch', mockFetch);

      const result = await getOnChainLosers(2);

      expect(result.length).toBe(2);
      // TK2 should be first (bigger loser)
      expect(result[0].symbol).toBe('TK2');
      expect(result[0].priceChangePercent24h).toBe(-25);
      expect(result[1].symbol).toBe('TK1');
      expect(result[1].priceChangePercent24h).toBe(-10);
    });
  });
});
