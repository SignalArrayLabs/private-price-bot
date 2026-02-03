import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { getCachedPrice, setCachedPrice } from '../../db/index.js';
import { CoinGeckoProvider } from './coingecko.js';
import { CoinCapProvider } from './coincap.js';
import { BinanceProvider } from './binance.js';
import { DexScreenerProvider } from './dexscreener.js';
import { isAddress } from '../../utils/validation.js';
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
// Routing: Contract addresses → DexScreener (auto-detect chain)
//          Symbols → CoinGecko fallback chain
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

  // Route based on input type
  // Contract addresses go directly to DexScreener (primary use case for on-chain tokens)
  // Symbols use traditional CoinGecko fallback chain (for majors like BTC, ETH)
  if (isAddress(symbolOrAddress)) {
    return await getPriceForAddress(symbolOrAddress, chain, cacheKey);
  }

  return await getPriceForSymbol(symbolOrAddress, chain, cacheKey);
}

// Get price for contract address - DexScreener with auto-chain detection
async function getPriceForAddress(
  address: string,
  chain: SupportedChain | undefined,
  cacheKey: string
): Promise<PriceData | null> {
  const dexScreener = getProvider('dexscreener');
  if (!dexScreener) {
    logger.error('DexScreener provider not initialized');
    return null;
  }

  // If chain is specified, try that chain only
  if (chain) {
    const data = await tryDexScreener(dexScreener, address, chain);
    if (data) {
      cachePrice(cacheKey, data);
      return data;
    }
    logger.warn({ address, chain }, 'Token not found on specified chain');
    return null;
  }

  // Auto-detect chain: try each supported chain
  const chainsToTry: SupportedChain[] = ['ethereum', 'bsc', 'polygon'];

  for (const tryChain of chainsToTry) {
    const data = await tryDexScreener(dexScreener, address, tryChain);
    if (data) {
      logger.debug({ address, chain: tryChain }, 'Token found via auto-detection');
      cachePrice(cacheKey, data);
      return data;
    }
  }

  logger.warn({ address }, 'Token not found on any supported DEX chain');
  return null;
}

// Helper to try DexScreener for a specific chain
async function tryDexScreener(
  provider: PriceProvider,
  address: string,
  chain: SupportedChain
): Promise<PriceData | null> {
  try {
    const healthy = await provider.isHealthy();
    if (!healthy) {
      logger.debug('DexScreener unhealthy, skipping');
      return null;
    }
    return await provider.getPrice(address, chain);
  } catch (error) {
    logger.debug({ address, chain, error }, 'DexScreener lookup failed');
    return null;
  }
}

// Get price for symbol - CoinGecko fallback chain
async function getPriceForSymbol(
  symbol: string,
  chain: SupportedChain | undefined,
  cacheKey: string
): Promise<PriceData | null> {
  // Use traditional fallback order for symbols (majors)
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
      const data = await provider.getPrice(symbol, chain);
      if (data) {
        cachePrice(cacheKey, data);
        logger.debug({
          provider: providerName,
          symbol,
        }, 'Price fetched successfully');
        return data;
      }
    } catch (error) {
      logger.warn({
        provider: providerName,
        symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Provider failed, trying next');
    }
  }

  logger.warn({ symbol }, 'All providers failed');
  return null;
}

// Helper to cache price data
function cachePrice(cacheKey: string, data: PriceData): void {
  const ttl = config.cacheTtlPrice;
  memoryCache.set(cacheKey, {
    data,
    expiry: Date.now() + ttl * 1000,
  });
  // Extract symbol for DB cache
  const [symbolOrAddress, chain] = cacheKey.split(':');
  setCachedPrice(
    symbolOrAddress,
    data,
    ttl,
    chain !== 'default' ? chain as SupportedChain : undefined
  );
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
