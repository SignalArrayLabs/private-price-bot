import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { TrendingToken } from '../../types/index.js';

interface CoinGeckoTrendingResponse {
  coins: Array<{
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number | null;
      thumb: string;
      small: string;
      large: string;
      slug: string;
      price_btc: number;
      score: number;
      data?: {
        price?: number;
        price_change_percentage_24h?: { usd?: number };
      };
    };
  }>;
}

// In-memory cache for trending (updates relatively slowly)
let cachedTrending: { data: TrendingToken[]; expiry: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getTrendingTokens(): Promise<TrendingToken[]> {
  // Check cache first
  if (cachedTrending && cachedTrending.expiry > Date.now()) {
    return cachedTrending.data;
  }

  try {
    const baseUrl = config.coingeckoBaseUrl;
    const url = `${baseUrl}/search/trending`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'PrivatePriceBot/1.0',
    };

    if (config.coingeckoApiKey) {
      headers['x-cg-pro-api-key'] = config.coingeckoApiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Trending API returned non-OK status');
      return [];
    }

    const data = await response.json() as CoinGeckoTrendingResponse;

    if (!data.coins || data.coins.length === 0) {
      return [];
    }

    const tokens: TrendingToken[] = data.coins.slice(0, 7).map(coin => ({
      id: coin.item.id,
      symbol: coin.item.symbol,
      name: coin.item.name,
      marketCapRank: coin.item.market_cap_rank,
      thumb: coin.item.thumb,
      price: coin.item.data?.price,
      priceChangePercent24h: coin.item.data?.price_change_percentage_24h?.usd,
    }));

    // Cache the result
    cachedTrending = {
      data: tokens,
      expiry: Date.now() + CACHE_TTL_MS,
    };

    return tokens;
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to fetch trending tokens');
    return [];
  }
}

// Clear trending cache (useful for testing)
export function clearTrendingCache(): void {
  cachedTrending = null;
}
