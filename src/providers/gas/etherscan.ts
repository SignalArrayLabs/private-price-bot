import { logger } from '../../utils/logger.js';
import { config, CHAIN_CONFIG, type SupportedChain } from '../../config/index.js';
import type { GasData } from '../../types/index.js';

interface EtherscanGasResponse {
  status: string;
  message: string;
  result: {
    LastBlock: string;
    SafeGasPrice: string;
    ProposeGasPrice: string;
    FastGasPrice: string;
    suggestBaseFee?: string;
    gasUsedRatio?: string;
  };
}

// In-memory cache for gas prices (short TTL since gas changes frequently)
const gasCache = new Map<SupportedChain, { data: GasData; expiry: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function getApiKey(chain: SupportedChain): string | undefined {
  switch (chain) {
    case 'ethereum':
      return config.etherscanApiKey;
    case 'bsc':
      return config.bscscanApiKey;
    case 'polygon':
      return config.polygonscanApiKey;
    default:
      return undefined;
  }
}

export async function getGasPrice(chain: SupportedChain = 'ethereum'): Promise<GasData | null> {
  // Check cache first
  const cached = gasCache.get(chain);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const chainConfig = CHAIN_CONFIG[chain];
  if (!chainConfig) {
    logger.warn({ chain }, 'Unsupported chain for gas prices');
    return null;
  }

  try {
    const apiKey = getApiKey(chain);
    let url = `${chainConfig.explorerApiUrl}?module=gastracker&action=gasoracle`;

    if (apiKey) {
      url += `&apikey=${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PrivatePriceBot/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status, chain }, 'Gas API returned non-OK status');
      return null;
    }

    const data = await response.json() as EtherscanGasResponse;

    if (data.status !== '1' || !data.result) {
      logger.warn({ message: data.message, chain }, 'Gas API returned error');
      return null;
    }

    const gasData: GasData = {
      chain,
      low: parseInt(data.result.SafeGasPrice, 10),
      average: parseInt(data.result.ProposeGasPrice, 10),
      fast: parseInt(data.result.FastGasPrice, 10),
      baseFee: data.result.suggestBaseFee ? parseFloat(data.result.suggestBaseFee) : undefined,
      lastBlock: parseInt(data.result.LastBlock, 10),
      lastUpdated: new Date(),
    };

    // Cache the result
    gasCache.set(chain, {
      data: gasData,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return gasData;
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error',
      chain,
    }, 'Failed to fetch gas prices');
    return null;
  }
}

// Get gas prices for all chains
export async function getAllGasPrices(): Promise<Map<SupportedChain, GasData>> {
  const results = new Map<SupportedChain, GasData>();
  const chains: SupportedChain[] = ['ethereum', 'bsc', 'polygon'];

  await Promise.all(
    chains.map(async (chain) => {
      const data = await getGasPrice(chain);
      if (data) {
        results.set(chain, data);
      }
    })
  );

  return results;
}

// Clear gas cache (useful for testing)
export function clearGasCache(): void {
  gasCache.clear();
}
