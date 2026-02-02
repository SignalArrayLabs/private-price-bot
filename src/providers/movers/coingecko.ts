import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { MoverToken } from '../../types/index.js';

interface CoinGeckoMarketResponse {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

// In-memory cache
const moversCache = {
  gainers: { data: [] as MoverToken[], expiry: 0 },
  losers: { data: [] as MoverToken[], expiry: 0 },
};
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function fetchMarketData(order: 'price_change_percentage_24h_desc' | 'price_change_percentage_24h_asc', limit: number): Promise<MoverToken[]> {
  try {
    const baseUrl = config.coingeckoBaseUrl;
    // Filter by market cap to avoid micro-cap coins that can have huge swings
    const url = `${baseUrl}/coins/markets?vs_currency=usd&order=${order}&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'PrivatePriceBot/1.0',
    };

    if (config.coingeckoApiKey) {
      headers['x-cg-pro-api-key'] = config.coingeckoApiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Movers API returned non-OK status');
      return [];
    }

    const data = await response.json() as CoinGeckoMarketResponse[];

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.current_price,
      priceChangePercent24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
    }));
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to fetch market data');
    return [];
  }
}

export async function getTopGainers(limit: number = 5): Promise<MoverToken[]> {
  // Check cache
  if (moversCache.gainers.expiry > Date.now() && moversCache.gainers.data.length >= limit) {
    return moversCache.gainers.data.slice(0, limit);
  }

  // Fetch more than requested to have buffer for cache
  const data = await fetchMarketData('price_change_percentage_24h_desc', 15);

  if (data.length > 0) {
    moversCache.gainers = {
      data,
      expiry: Date.now() + CACHE_TTL_MS,
    };
  }

  return data.slice(0, limit);
}

export async function getTopLosers(limit: number = 5): Promise<MoverToken[]> {
  // Check cache
  if (moversCache.losers.expiry > Date.now() && moversCache.losers.data.length >= limit) {
    return moversCache.losers.data.slice(0, limit);
  }

  // Fetch more than requested to have buffer for cache
  const data = await fetchMarketData('price_change_percentage_24h_asc', 15);

  if (data.length > 0) {
    moversCache.losers = {
      data,
      expiry: Date.now() + CACHE_TTL_MS,
    };
  }

  return data.slice(0, limit);
}

// Clear movers cache (useful for testing)
export function clearMoversCache(): void {
  moversCache.gainers = { data: [], expiry: 0 };
  moversCache.losers = { data: [], expiry: 0 };
}
