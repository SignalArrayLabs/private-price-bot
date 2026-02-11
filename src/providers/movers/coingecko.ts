import { createHash } from 'crypto';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { MoverToken } from '../../types/index.js';

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

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
  logger.info({ order, limit }, '[CG-MOVERS] fetchMarketData called');
  try {
    const baseUrl = config.coingeckoBaseUrl;
    logger.info({ baseUrl }, '[CG-MOVERS] Using base URL');
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

    logger.info({ status: response.status, ok: response.ok }, '[CG-MOVERS] Got response');
    if (!response.ok) {
      logger.warn({ status: response.status }, '[CG-MOVERS] Non-OK status');
      return [];
    }

    const rawBody = await response.text();
    const responseSize = rawBody.length;
    const bodyHash = sha256(rawBody);
    const serverDate = response.headers.get('date') || 'no-date';

    logger.info({
      provider: 'coingecko',
      endpoint: url.split('?')[0],
      order,
      responseSize,
      bodyHash,
      serverDate,
      timestamp: new Date().toISOString(),
    }, 'API call completed');

    const data = JSON.parse(rawBody) as CoinGeckoMarketResponse[];
    logger.info({ parsedCount: data.length, isArray: Array.isArray(data) }, '[CG-MOVERS] Parsed data');

    if (!Array.isArray(data) || data.length === 0) {
      logger.warn('[CG-MOVERS] Empty or invalid data array');
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
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, '[CG-MOVERS] FETCH FAILED');
    return [];
  }
}

export async function getTopGainers(limit: number = 5): Promise<MoverToken[]> {
  logger.info({ limit, cacheExpiry: moversCache.gainers.expiry, now: Date.now() }, '[CG-MOVERS] getTopGainers called');
  // Check cache
  if (moversCache.gainers.expiry > Date.now() && moversCache.gainers.data.length >= limit) {
    logger.info({ cached: true }, '[CG-MOVERS] Returning cached gainers');
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
