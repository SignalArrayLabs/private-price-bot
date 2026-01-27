import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { getCachedPrice, setCachedPrice } from '../../db/index.js';
import { CoinGeckoProvider } from './coingecko.js';
import { CoinCapProvider } from './coincap.js';
import { BinanceProvider } from './binance.js';
import { DexScreenerProvider } from './dexscreener.js';
import type { PriceData, TokenInfo, PriceProvider } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';

// Provider registry
const providers: Map<string, PriceProvider> = new Map();

// Initialize providers
// Order matters: CoinGecko for listed tokens, DexScreener for new/DEX tokens
function initProviders(): void {
  providers.set('coingecko', new CoinGeckoProvider());
  providers.set('dexscreener', new DexScreenerProvider());
  providers.set('coincap', new CoinCapProvider());
  providers.set('binance', new BinanceProvider());
}

// Get provider by name
function getProvider(name: string): PriceProvider | undefined {
  if (providers.size === 0) {
    initProviders();
  }
  return providers.get(name);
}

// Get all providers in fallback order
// CoinGecko first (established tokens), DexScreener second (new/DEX tokens), then others
function getProviderOrder(): string[] {
  const primary = config.priceProvider;
  const fallbacks = ['coingecko', 'dexscreener', 'coincap', 'binance'].filter(p => p !== primary);
  return [primary, ...fallbacks];
}

// In-memory cache for quick lookups
const memoryCache = new Map<string, { data: PriceData; expiry: number }>();

function getCacheKey(symbolOrAddress: string, chain?: SupportedChain): string {
  return `${symbolOrAddress.toLowerCase()}:${chain ?? 'default'}`;
}

// Get price with caching and fallback
export async function getPrice(
  symbolOrAddress: string,
  chain?: SupportedChain,
  skipCache = false
): Promise<PriceData | null> {
  if (providers.size === 0) {
    initProviders();
  }

  const cacheKey = getCacheKey(symbolOrAddress, chain);

  // Check memory cache first
  if (!skipCache) {
    const memoryCached = memoryCache.get(cacheKey);
    if (memoryCached && memoryCached.expiry > Date.now()) {
      return memoryCached.data;
    }

    // Check database cache
    const dbCached = getCachedPrice(symbolOrAddress, chain);
    if (dbCached) {
      memoryCache.set(cacheKey, {
        data: dbCached.data,
        expiry: Date.now() + dbCached.ttlSeconds * 1000,
      });
      return dbCached.data;
    }
  }

  // Try providers in order
  const providerOrder = getProviderOrder();

  for (const providerName of providerOrder) {
    const provider = getProvider(providerName);
    if (!provider) continue;

    // Skip if provider is unhealthy
    const healthy = await provider.isHealthy();
    if (!healthy) {
      logger.debug({ provider: providerName }, 'Skipping unhealthy provider');
      continue;
    }

    try {
      const data = await provider.getPrice(symbolOrAddress, chain);
      if (data) {
        // Cache the result
        const ttl = config.cacheTtlPrice;
        memoryCache.set(cacheKey, {
          data,
          expiry: Date.now() + ttl * 1000,
        });
        setCachedPrice(symbolOrAddress, data, ttl, chain);

        logger.debug({
          provider: providerName,
          symbol: symbolOrAddress,
        }, 'Price fetched successfully');

        return data;
      }
    } catch (error) {
      logger.warn({
        provider: providerName,
        symbol: symbolOrAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Provider failed, trying next');
    }
  }

  logger.warn({ symbol: symbolOrAddress }, 'All providers failed');
  return null;
}

// Search for tokens
export async function searchToken(query: string): Promise<TokenInfo[]> {
  if (providers.size === 0) {
    initProviders();
  }

  const providerOrder = getProviderOrder();

  for (const providerName of providerOrder) {
    const provider = getProvider(providerName);
    if (!provider) continue;

    const healthy = await provider.isHealthy();
    if (!healthy) continue;

    try {
      const results = await provider.searchToken(query);
      if (results.length > 0) {
        return results;
      }
    } catch {
      continue;
    }
  }

  return [];
}

// Get current provider status
export async function getProviderStatus(): Promise<{
  primary: string;
  providers: Array<{ name: string; healthy: boolean }>;
}> {
  if (providers.size === 0) {
    initProviders();
  }

  const status: Array<{ name: string; healthy: boolean }> = [];

  for (const [name, provider] of providers) {
    const healthy = await provider.isHealthy();
    status.push({ name, healthy });
  }

  return {
    primary: config.priceProvider,
    providers: status,
  };
}

// Clear caches
export function clearPriceCache(): void {
  memoryCache.clear();
}

// Export providers for direct access if needed
export { CoinGeckoProvider, DexScreenerProvider, CoinCapProvider, BinanceProvider };
