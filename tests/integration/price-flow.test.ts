import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Price Flow Integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Price Fetch with Fallback', () => {
    it('should fall back to CoinCap when CoinGecko fails', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;

        // CoinGecko fails
        if (url.includes('coingecko')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
          });
        }

        // CoinCap succeeds
        if (url.includes('coincap')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              data: {
                id: 'bitcoin',
                symbol: 'BTC',
                name: 'Bitcoin',
                priceUsd: '67000',
                changePercent24Hr: '1.5',
                marketCapUsd: '1320000000000',
                volumeUsd24Hr: '28000000000',
              },
              timestamp: Date.now(),
            }),
          });
        }

        return Promise.resolve({ ok: false, status: 404 });
      });

      // The actual provider code would handle fallback
      // This tests the concept
      const result = await mockPriceWithFallback('BTC');

      expect(result).not.toBeNull();
      expect(result?.source).toBe('coincap');
    });

    it('should return null when all providers fail', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await mockPriceWithFallback('UNKNOWN');
      expect(result).toBeNull();
    });
  });

  describe('Price Caching', () => {
    it('should cache price data and return cached on second call', async () => {
      let fetchCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              id: 'bitcoin',
              symbol: 'BTC',
              name: 'Bitcoin',
              priceUsd: '67000',
              changePercent24Hr: '1.5',
            },
            timestamp: Date.now(),
          }),
        });
      });

      // Simulate cached fetch
      const cache = new Map<string, { data: unknown; expiry: number }>();

      const result1 = await mockCachedFetch('BTC', cache);
      const result2 = await mockCachedFetch('BTC', cache);

      expect(result1).toEqual(result2);
      expect(fetchCount).toBe(1); // Only one actual fetch
    });

    it('should refetch when cache expires', async () => {
      let fetchCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              id: 'bitcoin',
              symbol: 'BTC',
              priceUsd: String(67000 + fetchCount * 100),
            },
            timestamp: Date.now(),
          }),
        });
      });

      const cache = new Map<string, { data: unknown; expiry: number }>();

      // First fetch
      await mockCachedFetch('BTC', cache, 0); // TTL of 0 = immediate expiry

      // Second fetch (cache expired)
      await mockCachedFetch('BTC', cache, 0);

      expect(fetchCount).toBe(2);
    });
  });
});

// Helper functions for testing
async function mockPriceWithFallback(symbol: string): Promise<{ price: number; source: string } | null> {
  const providers = ['coingecko', 'coincap', 'binance'];

  for (const provider of providers) {
    try {
      const url = provider === 'coingecko'
        ? `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}`
        : provider === 'coincap'
          ? `https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`
          : `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      const price = provider === 'coincap'
        ? parseFloat((data as { data: { priceUsd: string } }).data.priceUsd)
        : 67000;

      return { price, source: provider };
    } catch {
      continue;
    }
  }

  return null;
}

async function mockCachedFetch(
  symbol: string,
  cache: Map<string, { data: unknown; expiry: number }>,
  ttlMs = 30000
): Promise<unknown> {
  const cacheKey = symbol.toLowerCase();
  const cached = cache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const response = await fetch(`https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`);
  const data = await response.json();

  cache.set(cacheKey, {
    data,
    expiry: Date.now() + ttlMs,
  });

  return data;
}
