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

      // Aggregate data across all pairs for this token
      return this.aggregatePairData(pairs);
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

      // Find exact symbol match first
      const normalizedQuery = query.toUpperCase();

      // Filter for exact symbol matches
      const exactMatches = data.pairs.filter(
        p => p.baseToken.symbol.toUpperCase() === normalizedQuery
      );

      const pairs = exactMatches.length > 0 ? exactMatches : data.pairs;

      // Group by token to handle symbol collisions (e.g., PENGU vs PENGUIN)
      const grouped = this.groupPairsByToken(pairs);

      if (grouped.size === 0) {
        return null;
      }

      // If multiple tokens match, pick the one with highest total VOLUME (not liquidity)
      // This avoids selecting fake tokens with inflated liquidity but no real trading
      let bestTokenPairs: DexScreenerPair[] = [];
      let maxVolume = 0;

      for (const tokenPairs of grouped.values()) {
        const totalVolume = tokenPairs.reduce((sum, p) => sum + (p.volume?.h24 ?? 0), 0);
        if (totalVolume > maxVolume) {
          maxVolume = totalVolume;
          bestTokenPairs = tokenPairs;
        }
      }

      // Aggregate data across all pairs for the selected token
      return this.aggregatePairData(bestTokenPairs);
    } catch {
      return null;
    }
  }

  private groupPairsByToken(pairs: DexScreenerPair[]): Map<string, DexScreenerPair[]> {
    const grouped = new Map<string, DexScreenerPair[]>();

    for (const pair of pairs) {
      // Group by token address (or symbol if address not available)
      const key = pair.baseToken.address || pair.baseToken.symbol.toUpperCase();

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(pair);
    }

    return grouped;
  }

  private aggregatePairData(pairs: DexScreenerPair[]): PriceData {
    // Limit to top 20 pairs by liquidity for performance
    const topPairs = pairs
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
      .slice(0, 20);

    // Get reference pair (highest liquidity) for price and metadata
    const refPair = topPairs[0];
    const price = parseFloat(refPair.priceUsd) || 0;

    // Aggregate volume across all pairs
    const totalVolume = topPairs.reduce((sum, pair) => sum + (pair.volume?.h24 ?? 0), 0);

    // Use highest market cap or FDV available
    const marketCap = Math.max(
      ...topPairs.map(p => p.marketCap ?? p.fdv ?? 0)
    );

    // Build DexScreener URL for the reference pair
    const dexScreenerUrl = `https://dexscreener.com/${refPair.chainId}/${refPair.pairAddress}`;

    // Debug logging
    console.log('[DEBUG] Selected pair:', refPair.baseToken.symbol, 'on', refPair.chainId,
                'liquidity:', refPair.liquidity?.usd, 'volume:', refPair.volume?.h24,
                'total aggregated volume:', totalVolume, 'from', topPairs.length, 'pairs');

    return {
      symbol: refPair.baseToken.symbol.toUpperCase(),
      name: refPair.baseToken.name,
      price,
      priceChange24h: price * (refPair.priceChange?.h24 ?? 0) / 100,
      priceChangePercent24h: refPair.priceChange?.h24 ?? 0,
      marketCap,
      volume24h: totalVolume, // Aggregated across all pairs
      high24h: 0, // DexScreener doesn't provide this
      low24h: 0,  // DexScreener doesn't provide this
      lastUpdated: new Date(),
      address: refPair.baseToken.address,
      dexScreenerUrl, // Link to the exact pair used
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
