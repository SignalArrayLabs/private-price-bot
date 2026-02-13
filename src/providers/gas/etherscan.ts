import { logger } from '../../utils/logger.js';
import { config, CHAIN_CONFIG, type SupportedChain } from '../../config/index.js';
import type { GasData } from '../../types/index.js';

// Etherscan V2 response format
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

// Owlracle response format (for BSC/Polygon)
interface OwlracleSpeed {
  acceptance: number;
  maxFeePerGas: number;
  maxPriorityFeePerGas: number | null;
  baseFee?: number;
}

interface OwlracleGasResponse {
  timestamp: string;
  avgTime: number;
  avgTx: number;
  avgGas: number;
  speeds: OwlracleSpeed[];
}

// In-memory cache for gas prices (short TTL since gas changes frequently)
const gasCache = new Map<SupportedChain, { data: GasData; expiry: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Owlracle chain identifiers
const OWLRACLE_CHAINS: Record<string, string> = {
  bsc: 'bsc',
  polygon: 'poly',
};

/**
 * Fetch gas prices from Etherscan V2 API (Ethereum only)
 */
async function fetchEtherscanGas(chain: SupportedChain): Promise<GasData | null> {
  const chainConfig = CHAIN_CONFIG[chain];
  if (!chainConfig) return null;

  try {
    let url = `${chainConfig.explorerApiUrl}?chainid=${chainConfig.chainId}&module=gastracker&action=gasoracle`;

    if (config.etherscanApiKey) {
      url += `&apikey=${config.etherscanApiKey}`;
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
      logger.warn({ status: response.status, chain }, '[GAS] Etherscan API non-OK');
      return null;
    }

    const data = await response.json() as EtherscanGasResponse;

    if (data.status !== '1' || !data.result) {
      logger.warn({ message: data.message, chain }, '[GAS] Etherscan API error');
      return null;
    }

    return {
      chain,
      low: parseFloat(data.result.SafeGasPrice),
      average: parseFloat(data.result.ProposeGasPrice),
      fast: parseFloat(data.result.FastGasPrice),
      baseFee: data.result.suggestBaseFee ? parseFloat(data.result.suggestBaseFee) : undefined,
      lastBlock: parseInt(data.result.LastBlock, 10),
      lastUpdated: new Date(),
    };
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error',
      chain,
    }, '[GAS] Etherscan fetch failed');
    return null;
  }
}

/**
 * Fetch gas prices from Owlracle API (BSC, Polygon)
 * Free tier, no API key required
 */
async function fetchOwlracleGas(chain: SupportedChain): Promise<GasData | null> {
  const owlChain = OWLRACLE_CHAINS[chain];
  if (!owlChain) return null;

  try {
    const url = `https://api.owlracle.info/v4/${owlChain}/gas`;

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
      logger.warn({ status: response.status, chain }, '[GAS] Owlracle API non-OK');
      return null;
    }

    const data = await response.json() as OwlracleGasResponse;

    if (!data.speeds || data.speeds.length < 3) {
      logger.warn({ chain }, '[GAS] Owlracle returned insufficient data');
      return null;
    }

    // Owlracle returns speeds at different acceptance levels
    // Map to low/average/fast using acceptance thresholds
    const slow = data.speeds.find(s => s.acceptance <= 0.5) || data.speeds[0];
    const avg = data.speeds.find(s => s.acceptance >= 0.6 && s.acceptance <= 0.7) || data.speeds[1];
    const fast = data.speeds.find(s => s.acceptance >= 0.9) || data.speeds[data.speeds.length - 1];

    return {
      chain,
      low: Math.round(slow.maxFeePerGas * 1000) / 1000,
      average: Math.round(avg.maxFeePerGas * 1000) / 1000,
      fast: Math.round(fast.maxFeePerGas * 1000) / 1000,
      baseFee: slow.baseFee ? Math.round(slow.baseFee * 1000) / 1000 : undefined,
      lastBlock: undefined, // Owlracle doesn't provide block number
      lastUpdated: new Date(),
    };
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error',
      chain,
    }, '[GAS] Owlracle fetch failed');
    return null;
  }
}

/**
 * Get gas prices for a chain
 * Uses Etherscan V2 for Ethereum, Owlracle for BSC/Polygon
 */
export async function getGasPrice(chain: SupportedChain = 'ethereum'): Promise<GasData | null> {
  // Check cache first
  const cached = gasCache.get(chain);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // Solana doesn't have gas prices in the traditional sense
  if (chain === 'solana') {
    logger.debug({ chain }, '[GAS] Solana gas not supported');
    return null;
  }

  let gasData: GasData | null = null;

  // Route to appropriate provider
  if (chain === 'ethereum') {
    gasData = await fetchEtherscanGas(chain);
  } else if (chain === 'bsc' || chain === 'polygon') {
    gasData = await fetchOwlracleGas(chain);
  }

  // Cache the result
  if (gasData) {
    gasCache.set(chain, {
      data: gasData,
      expiry: Date.now() + CACHE_TTL_MS,
    });
    logger.info({ chain, low: gasData.low, avg: gasData.average, fast: gasData.fast }, '[GAS] Fetched');
  }

  return gasData;
}

/**
 * Get gas prices for all supported EVM chains
 */
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

/**
 * Clear gas cache (useful for testing)
 */
export function clearGasCache(): void {
  gasCache.clear();
}
