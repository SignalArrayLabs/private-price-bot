import { EtherscanProvider } from './etherscan.js';
import { WebsiteChecker } from './website.js';
import type { ContractSecurity, DeployerInfo, WebsiteSimilarity, TwitterCheck } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

// Provider instances
let etherscanProvider: EtherscanProvider | null = null;
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

  const provider = getEtherscanProvider();

  try {
    const healthy = await provider.isHealthy();
    if (!healthy) {
      logger.warn({ chain }, 'Security provider unhealthy');
      return null;
    }

    const data = await provider.getContractSecurity(address, chain);

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

  const provider = getEtherscanProvider();

  try {
    const healthy = await provider.isHealthy();
    if (!healthy) {
      logger.warn({ chain }, 'Security provider unhealthy');
      return null;
    }

    const data = await provider.getDeployerInfo(address, chain);

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

export { EtherscanProvider, WebsiteChecker };
