import { BasePriceProvider } from './base.js';
import type { PriceData, TokenInfo } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// DexScreener API response types
interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
  };
  priceChange: {
    h24: number;
  };
  liquidity?: {
    usd: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

interface DexScreenerSearchResponse {
  pairs: DexScreenerPair[];
}

// Map our chain names to DexScreener chain IDs
const CHAIN_TO_DEXSCREENER: Record<string, string> = {
  ethereum: 'ethereum',
  bsc: 'bsc',
  polygon: 'polygon',
  solana: 'solana',
  arbitrum: 'arbitrum',
  base: 'base',
  avalanche: 'avalanche',
};

export class DexScreenerProvider extends BasePriceProvider {
  name = 'DexScreener';
  private baseUrl = 'https://api.dexscreener.com/latest';

  async getPrice(symbolOrAddress: string, chain?: SupportedChain): Promise<PriceData | null> {
    try {
      // If it's an address, lookup directly
      if (this.isAddress(symbolOrAddress)) {
        return await this.getPriceByAddress(symbolOrAddress, chain);
      }

      // Search by symbol
      return await this.getPriceBySearch(symbolOrAddress);
    } catch (error) {
      logger.debug({ symbol: symbolOrAddress, error }, 'DexScreener lookup failed');
      return null;
    }
  }

  private async getPriceByAddress(address: string, chain?: SupportedChain): Promise<PriceData | null> {
    try {
      // DexScreener can search by token address across all chains
      const url = `${this.baseUrl}/dex/tokens/${address}`;
      const data = await this.fetchWithTimeout<DexScreenerResponse>(url);

      if (!data.pairs || data.pairs.length === 0) {
        return null;
      }

      // Filter by chain if specified
      let pairs = data.pairs;
      if (chain) {
        const dexChain = CHAIN_TO_DEXSCREENER[chain];
        if (dexChain) {
          pairs = pairs.filter(p => p.chainId === dexChain);
        }
      }

      if (pairs.length === 0) {
        return null;
      }

      // Get the pair with highest liquidity
      const bestPair = this.getBestPair(pairs);
      return this.pairToPriceData(bestPair);
    } catch {
      return null;
    }
  }

  private async getPriceBySearch(query: string): Promise<PriceData | null> {
    try {
      const url = `${this.baseUrl}/dex/search?q=${encodeURIComponent(query)}`;
      const data = await this.fetchWithTimeout<DexScreenerSearchResponse>(url);

      if (!data.pairs || data.pairs.length === 0) {
        return null;
      }

      // Find exact symbol match first, prioritize by liquidity/market cap
      const normalizedQuery = query.toUpperCase();

      // Filter for exact symbol matches
      const exactMatches = data.pairs.filter(
        p => p.baseToken.symbol.toUpperCase() === normalizedQuery
      );

      const pairs = exactMatches.length > 0 ? exactMatches : data.pairs;
      const bestPair = this.getBestPair(pairs);

      return this.pairToPriceData(bestPair);
    } catch {
      return null;
    }
  }

  private getBestPair(pairs: DexScreenerPair[]): DexScreenerPair {
    // Sort by liquidity (higher is better), then by volume
    return pairs.sort((a, b) => {
      const liquidityA = a.liquidity?.usd ?? 0;
      const liquidityB = b.liquidity?.usd ?? 0;
      if (liquidityA !== liquidityB) {
        return liquidityB - liquidityA;
      }
      return (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0);
    })[0];
  }

  private pairToPriceData(pair: DexScreenerPair): PriceData {
    const price = parseFloat(pair.priceUsd) || 0;

    return {
      symbol: pair.baseToken.symbol.toUpperCase(),
      name: pair.baseToken.name,
      price,
      priceChange24h: price * (pair.priceChange?.h24 ?? 0) / 100,
      priceChangePercent24h: pair.priceChange?.h24 ?? 0,
      marketCap: pair.marketCap ?? pair.fdv ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      high24h: 0, // DexScreener doesn't provide this
      low24h: 0,  // DexScreener doesn't provide this
      lastUpdated: new Date(),
      address: pair.baseToken.address,
    };
  }

  async searchToken(query: string): Promise<TokenInfo[]> {
    try {
      const url = `${this.baseUrl}/dex/search?q=${encodeURIComponent(query)}`;
      const data = await this.fetchWithTimeout<DexScreenerSearchResponse>(url);

      if (!data.pairs) {
        return [];
      }

      // Deduplicate by symbol
      const seen = new Set<string>();
      const results: TokenInfo[] = [];

      for (const pair of data.pairs) {
        const symbol = pair.baseToken.symbol.toUpperCase();
        if (!seen.has(symbol)) {
          seen.add(symbol);
          results.push({
            symbol,
            name: pair.baseToken.name,
            address: pair.baseToken.address,
          });
        }
        if (results.length >= 10) break;
      }

      return results;
    } catch {
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    if (this.isDown) {
      if (this.downSince && Date.now() - this.downSince.getTime() < this.backoffMs) {
        return false;
      }
    }

    try {
      // Simple health check - search for BTC
      const url = `${this.baseUrl}/dex/search?q=BTC`;
      await this.fetchWithTimeout<DexScreenerSearchResponse>(url, {}, 5000);
      return true;
    } catch {
      return false;
    }
  }
}
