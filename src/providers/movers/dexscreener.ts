import { logger } from '../../utils/logger.js';
import type { MoverToken } from '../../types/index.js';

interface DexScreenerPair {
  chainId: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange: {
    h24: number;
  };
  volume: {
    h24: number;
  };
  liquidity?: {
    usd: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface DexScreenerSearchResponse {
  pairs: DexScreenerPair[];
}

// In-memory cache
const onchainMoversCache = {
  gainers: { data: [] as MoverToken[], expiry: 0 },
  losers: { data: [] as MoverToken[], expiry: 0 },
};
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Minimum filters to avoid scams and rug-pulls
const MIN_LIQUIDITY = 10000; // $10k
const MIN_VOLUME = 5000; // $5k
const MIN_PAIR_AGE_HOURS = 1; // 1 hour old

async function fetchOnChainMovers(ascending: boolean, limit: number): Promise<MoverToken[]> {
  try {
    const baseUrl = 'https://api.dexscreener.com/latest';

    // Strategy: Search for empty query to get trending/recent pairs
    // Then filter and sort by price change
    const url = `${baseUrl}/dex/search?q=`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PrivatePriceBot/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'DexScreener movers API returned non-OK status');
      return [];
    }

    const data = await response.json() as DexScreenerSearchResponse;

    if (!Array.isArray(data.pairs) || data.pairs.length === 0) {
      return [];
    }

    const now = Date.now();

    // Filter pairs by minimum criteria
    const filtered = data.pairs.filter(pair => {
      const liquidity = pair.liquidity?.usd ?? 0;
      const volume = pair.volume?.h24 ?? 0;
      const priceChange = pair.priceChange?.h24 ?? 0;
      const pairAge = pair.pairCreatedAt ? (now - pair.pairCreatedAt) / (1000 * 60 * 60) : 0;

      // Apply filters
      if (liquidity < MIN_LIQUIDITY) return false;
      if (volume < MIN_VOLUME) return false;
      if (pairAge < MIN_PAIR_AGE_HOURS) return false; // Avoid brand new pairs

      // Skip extreme outliers (likely errors or wash trading)
      if (Math.abs(priceChange) > 1000) return false;

      return true;
    });

    // Group by token to avoid duplicates
    const tokenMap = new Map<string, DexScreenerPair>();

    for (const pair of filtered) {
      const key = pair.baseToken.address || pair.baseToken.symbol;

      // Keep the pair with highest liquidity for each token
      const existing = tokenMap.get(key);
      if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
        tokenMap.set(key, pair);
      }
    }

    // Convert to array and sort by price change
    const tokens = Array.from(tokenMap.values())
      .sort((a, b) => {
        const changeA = a.priceChange?.h24 ?? 0;
        const changeB = b.priceChange?.h24 ?? 0;
        return ascending ? changeA - changeB : changeB - changeA;
      })
      .slice(0, limit)
      .map(pair => ({
        id: pair.baseToken.address || pair.baseToken.symbol,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        price: parseFloat(pair.priceUsd) || 0,
        priceChangePercent24h: pair.priceChange?.h24 ?? 0,
        marketCap: pair.marketCap ?? pair.fdv ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
      }));

    return tokens;
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to fetch on-chain movers');
    return [];
  }
}

export async function getOnChainGainers(limit: number = 5): Promise<MoverToken[]> {
  // Check cache
  if (onchainMoversCache.gainers.expiry > Date.now() && onchainMoversCache.gainers.data.length >= limit) {
    return onchainMoversCache.gainers.data.slice(0, limit);
  }

  // Fetch more than requested to have buffer for cache
  const data = await fetchOnChainMovers(false, 15);

  if (data.length > 0) {
    onchainMoversCache.gainers = {
      data,
      expiry: Date.now() + CACHE_TTL_MS,
    };
  }

  return data.slice(0, limit);
}

export async function getOnChainLosers(limit: number = 5): Promise<MoverToken[]> {
  // Check cache
  if (onchainMoversCache.losers.expiry > Date.now() && onchainMoversCache.losers.data.length >= limit) {
    return onchainMoversCache.losers.data.slice(0, limit);
  }

  // Fetch more than requested to have buffer for cache
  const data = await fetchOnChainMovers(true, 15);

  if (data.length > 0) {
    onchainMoversCache.losers = {
      data,
      expiry: Date.now() + CACHE_TTL_MS,
    };
  }

  return data.slice(0, limit);
}

// Clear cache (useful for testing)
export function clearOnChainMoversCache(): void {
  onchainMoversCache.gainers = { data: [], expiry: 0 };
  onchainMoversCache.losers = { data: [], expiry: 0 };
}
