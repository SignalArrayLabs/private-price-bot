import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexScreenerProvider } from '../../src/providers/price/dexscreener.js';
import type { PriceData } from '../../src/types/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const penguFixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/pengu-response.json'), 'utf-8'));
const penguinFixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/penguin-response.json'), 'utf-8'));

describe('DexScreenerProvider', () => {
  let provider: DexScreenerProvider;

  beforeEach(() => {
    provider = new DexScreenerProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('pair selection and volume aggregation', () => {
    it('selects highest liquidity pair for PENGU', async () => {
      // Mock fetchWithTimeout directly on the provider instance
      vi.spyOn(provider as any, 'fetchWithTimeout').mockResolvedValue(penguFixture);

      const result = await provider.getPrice('PENGU');

      expect(result).toBeTruthy();
      expect(result?.symbol).toBe('PENGU');
      expect(result?.name).toBe('Pudgy Penguins');

      // Volume should be aggregated from multiple pairs
      expect(result?.volume24h).toBeGreaterThan(10000); // Should be in thousands
      expect(result?.volume24h).toBeLessThan(100000000); // Sanity check

      // Should have DexScreener URL for the selected pair
      expect(result?.dexScreenerUrl).toMatch(/https:\/\/dexscreener\.com\/solana\//);
    });

    it('disambiguates PENGUIN from PENGU', async () => {
      // Mock fetchWithTimeout directly
      vi.spyOn(provider as any, 'fetchWithTimeout').mockResolvedValue(penguinFixture);

      const result = await provider.getPrice('PENGUIN');

      expect(result).toBeTruthy();
      expect(result?.symbol).toBe('PENGUIN');
      // Should NOT be PENGU
      expect(result?.symbol).not.toBe('PENGU');

      // Should have DexScreener URL
      expect(result?.dexScreenerUrl).toMatch(/https:\/\/dexscreener\.com\//);
    });

    it('includes dexScreenerUrl in result', async () => {
      vi.spyOn(provider as any, 'fetchWithTimeout').mockResolvedValue(penguFixture);

      const result = await provider.getPrice('PENGU');

      expect(result?.dexScreenerUrl).toBeDefined();
      expect(result?.dexScreenerUrl).toContain('dexscreener.com');
      expect(result?.dexScreenerUrl).toContain('solana');
    });

    it('aggregates volume from top 20 pairs by liquidity', async () => {
      // Create a mock response with multiple pairs having different liquidity
      const mockResponse = {
        pairs: [
          {
            chainId: 'ethereum',
            dexId: 'uniswap',
            pairAddress: '0x123',
            baseToken: { address: '0xabc', name: 'Test Token', symbol: 'TEST' },
            quoteToken: { symbol: 'WETH' },
            priceNative: '0.01',
            priceUsd: '10',
            txns: { h24: { buys: 100, sells: 100 } },
            volume: { h24: 50000 },
            priceChange: { h24: 5 },
            liquidity: { usd: 100000 },
            fdv: 10000000,
            marketCap: 5000000,
          },
          {
            chainId: 'ethereum',
            dexId: 'sushiswap',
            pairAddress: '0x456',
            baseToken: { address: '0xabc', name: 'Test Token', symbol: 'TEST' },
            quoteToken: { symbol: 'WETH' },
            priceNative: '0.01',
            priceUsd: '10',
            txns: { h24: { buys: 100, sells: 100 } },
            volume: { h24: 30000 },
            priceChange: { h24: 5 },
            liquidity: { usd: 50000 },
            fdv: 10000000,
            marketCap: 5000000,
          },
        ],
      };

      vi.spyOn(provider as any, 'fetchWithTimeout').mockResolvedValue(mockResponse);

      const result = await provider.getPrice('TEST');

      // Volume should be aggregated: 50000 + 30000 = 80000
      expect(result?.volume24h).toBe(80000);
    });
  });

  describe('error handling', () => {
    it('returns null when API fails', async () => {
      vi.spyOn(provider as any, 'fetchWithTimeout').mockRejectedValue(new Error('Network error'));

      const result = await provider.getPrice('FAIL');
      expect(result).toBeNull();
    });

    it('returns null when no pairs found', async () => {
      vi.spyOn(provider as any, 'fetchWithTimeout').mockResolvedValue({ pairs: [] });

      const result = await provider.getPrice('NOTFOUND');
      expect(result).toBeNull();
    });
  });
});
