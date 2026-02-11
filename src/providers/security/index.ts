import { createHash } from 'crypto';
import { EtherscanProvider } from './etherscan.js';
import { RugCheckProvider } from './rugcheck.js';
import { WebsiteChecker } from './website.js';
import type { ContractSecurity, DeployerInfo, WebsiteSimilarity, TwitterCheck } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

// SHA256 for API response verification
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

// DexScreener response types for symbol resolution
interface DexScreenerPair {
  chainId: string;
  baseToken: {
    address: string;
    symbol: string;
    name: string;
  };
  volume?: { h24: number };
  liquidity?: { usd: number };
}

interface DexScreenerSearchResponse {
  pairs: DexScreenerPair[] | null;
}

// Map DexScreener chainId to our SupportedChain
const DEXSCREENER_TO_CHAIN: Record<string, SupportedChain> = {
  ethereum: 'ethereum',
  bsc: 'bsc',
  polygon: 'polygon',
  solana: 'solana',
  arbitrum: 'ethereum', // fallback to ethereum for security scan
  base: 'ethereum',
  avalanche: 'ethereum',
};

export interface ResolvedToken {
  address: string;
  chain: SupportedChain;
  symbol: string;
  name: string;
}

/**
 * Resolve a ticker symbol to contract address using DexScreener
 * Returns the highest-volume token matching the symbol
 */
export async function resolveSymbolToAddress(symbol: string): Promise<ResolvedToken | null> {
  logger.info({ symbol }, '[SYMBOL-RESOLVE] Starting resolution');

  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, '[SYMBOL-RESOLVE] API returned non-OK');
      return null;
    }

    const rawBody = await response.text();
    const bodyHash = sha256(rawBody);
    const serverDate = response.headers.get('date') || 'no-date';

    logger.info({
      symbol,
      responseSize: rawBody.length,
      bodyHash,
      serverDate,
    }, '[SYMBOL-RESOLVE] API response received');

    const data = JSON.parse(rawBody) as DexScreenerSearchResponse;

    if (!data.pairs || data.pairs.length === 0) {
      logger.warn({ symbol }, '[SYMBOL-RESOLVE] No pairs found');
      return null;
    }

    // Filter for exact symbol matches (case-insensitive)
    const normalizedSymbol = symbol.toUpperCase();
    const exactMatches = data.pairs.filter(
      p => p.baseToken.symbol.toUpperCase() === normalizedSymbol
    );

    const candidates = exactMatches.length > 0 ? exactMatches : data.pairs;

    // Pick the token with highest 24h volume (avoids fake tokens with inflated liquidity)
    let bestPair: DexScreenerPair | null = null;
    let maxVolume = 0;

    for (const pair of candidates) {
      const volume = pair.volume?.h24 ?? 0;
      if (volume > maxVolume) {
        maxVolume = volume;
        bestPair = pair;
      }
    }

    if (!bestPair) {
      logger.warn({ symbol }, '[SYMBOL-RESOLVE] No valid pair found');
      return null;
    }

    // Map chainId to our supported chain type
    const chain = DEXSCREENER_TO_CHAIN[bestPair.chainId] || 'ethereum';

    const result: ResolvedToken = {
      address: bestPair.baseToken.address,
      chain,
      symbol: bestPair.baseToken.symbol,
      name: bestPair.baseToken.name,
    };

    logger.info({
      inputSymbol: symbol,
      resolvedAddress: result.address,
      resolvedChain: result.chain,
      resolvedName: result.name,
      volume24h: maxVolume,
    }, '[SYMBOL-RESOLVE] Resolution successful');

    return result;
  } catch (error) {
    logger.error({
      symbol,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, '[SYMBOL-RESOLVE] Resolution failed');
    return null;
  }
}

// Provider instances
let etherscanProvider: EtherscanProvider | null = null;
let rugcheckProvider: RugCheckProvider | null = null;
let websiteChecker: WebsiteChecker | null = null;

// In-memory cache for security data
const securityCache = new Map<string, { data: ContractSecurity; expiry: number }>();
const deployerCache = new Map<string, { data: DeployerInfo; expiry: number }>();

function getEtherscanProvider(): EtherscanProvider {
  if (!etherscanProvider) {
    etherscanProvider = new EtherscanProvider();
  }
  return etherscanProvider;
}

function getRugCheckProvider(): RugCheckProvider {
  if (!rugcheckProvider) {
    rugcheckProvider = new RugCheckProvider();
  }
  return rugcheckProvider;
}

function getWebsiteChecker(): WebsiteChecker {
  if (!websiteChecker) {
    websiteChecker = new WebsiteChecker();
  }
  return websiteChecker;
}

function getCacheKey(address: string, chain: SupportedChain): string {
  return `${address.toLowerCase()}:${chain}`;
}

// Get contract security with caching
export async function getContractSecurity(
  address: string,
  chain: SupportedChain,
  skipCache = false
): Promise<ContractSecurity | null> {
  const cacheKey = getCacheKey(address, chain);

  // Check cache
  if (!skipCache) {
    const cached = securityCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
  }

  try {
    let data: ContractSecurity | null = null;

    // Route to appropriate provider based on chain
    if (chain === 'solana') {
      // Use RugCheck for Solana (Solscan API deprecated)
      const provider = getRugCheckProvider();
      data = await provider.getContractSecurity(address);
    } else {
      // EVM chains (ethereum, bsc, polygon)
      const provider = getEtherscanProvider();
      const healthy = await provider.isHealthy();
      if (!healthy) {
        logger.warn({ chain }, 'Security provider unhealthy');
        return null;
      }
      data = await provider.getContractSecurity(address, chain);
    }

    if (data) {
      // Cache the result
      const ttl = config.cacheTtlSecurity * 1000;
      securityCache.set(cacheKey, {
        data,
        expiry: Date.now() + ttl,
      });
    }

    return data;
  } catch (error) {
    logger.error({
      address,
      chain,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to get contract security');
    return null;
  }
}

// Get deployer info with caching
export async function getDeployerInfo(
  address: string,
  chain: SupportedChain,
  skipCache = false
): Promise<DeployerInfo | null> {
  const cacheKey = getCacheKey(address, chain);

  // Check cache
  if (!skipCache) {
    const cached = deployerCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
  }

  try {
    let data: DeployerInfo | null = null;

    // Route to appropriate provider based on chain
    if (chain === 'solana') {
      // RugCheck doesn't provide deployer history for Solana
      logger.debug({ address }, 'Deployer info not available for Solana via RugCheck');
      return null;
    } else {
      // EVM chains (ethereum, bsc, polygon)
      const provider = getEtherscanProvider();
      const healthy = await provider.isHealthy();
      if (!healthy) {
        logger.warn({ chain }, 'Security provider unhealthy');
        return null;
      }
      data = await provider.getDeployerInfo(address, chain);
    }

    if (data) {
      // Cache the result
      const ttl = config.cacheTtlSecurity * 1000;
      deployerCache.set(cacheKey, {
        data,
        expiry: Date.now() + ttl,
      });
    }

    return data;
  } catch (error) {
    logger.error({
      address,
      chain,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to get deployer info');
    return null;
  }
}

// Check website
export async function checkWebsite(url: string): Promise<WebsiteSimilarity> {
  const checker = getWebsiteChecker();
  return checker.checkWebsite(url);
}

// Check Twitter handle
export async function checkTwitter(handle: string): Promise<TwitterCheck> {
  const checker = getWebsiteChecker();
  return checker.checkTwitter(handle);
}

// Get security provider status
export async function getSecurityProviderStatus(): Promise<{
  etherscan: boolean;
  hasEtherscanKey: boolean;
  hasBscscanKey: boolean;
  hasPolygonscanKey: boolean;
}> {
  const provider = getEtherscanProvider();
  const healthy = await provider.isHealthy();

  return {
    etherscan: healthy,
    hasEtherscanKey: Boolean(config.etherscanApiKey),
    hasBscscanKey: Boolean(config.bscscanApiKey),
    hasPolygonscanKey: Boolean(config.polygonscanApiKey),
  };
}

// Clear security caches
export function clearSecurityCache(): void {
  securityCache.clear();
  deployerCache.clear();
}

export { EtherscanProvider, RugCheckProvider, WebsiteChecker };
