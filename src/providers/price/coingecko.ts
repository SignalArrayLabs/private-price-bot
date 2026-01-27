import { BasePriceProvider } from './base.js';
import type { PriceData, TokenInfo } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { config, CHAIN_CONFIG } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

interface CoinGeckoSearchResult {
  coins: Array<{
    id: string;
    symbol: string;
    name: string;
    thumb: string;
    market_cap_rank: number | null;
  }>;
}

interface CoinGeckoCoinInfo {
  id: string;
  symbol: string;
  name: string;
  market_data?: {
    current_price?: { usd?: number };
    price_change_24h?: number;
    price_change_percentage_24h?: number;
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    high_24h?: { usd?: number };
    low_24h?: { usd?: number };
  };
  last_updated?: string;
}

// Quick lookup cache for common symbols (optimization only, not required)
// The bot will dynamically search CoinGecko for ANY token not in this list
const COMMON_SYMBOLS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  SHIB: 'shiba-inu',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
};

// Runtime cache for dynamically discovered tokens
const discoveredTokens: Map<string, string> = new Map();

export class CoinGeckoProvider extends BasePriceProvider {
  name = 'CoinGecko';
  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    super();
    this.baseUrl = config.coingeckoBaseUrl;
    this.apiKey = config.coingeckoApiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['x-cg-pro-api-key'] = this.apiKey;
    }
    return headers;
  }

  async getPrice(symbolOrAddress: string, chain?: SupportedChain): Promise<PriceData | null> {
    try {
      // Check if it's a contract address
      if (this.isAddress(symbolOrAddress) && chain) {
        return await this.getPriceByContract(symbolOrAddress, chain);
      }

      const symbol = this.normalizeSymbol(symbolOrAddress);

      // 1. Check common symbols cache
      if (COMMON_SYMBOLS[symbol]) {
        const result = await this.getPriceById(COMMON_SYMBOLS[symbol]);
        if (result) return result;
      }

      // 2. Check runtime discovered tokens cache
      if (discoveredTokens.has(symbol)) {
        const result = await this.getPriceById(discoveredTokens.get(symbol)!);
        if (result) return result;
      }

      // 3. Try direct lookup (symbol as ID)
      const directResult = await this.getPriceById(symbol.toLowerCase());
      if (directResult) {
        // Cache for future lookups
        discoveredTokens.set(symbol, symbol.toLowerCase());
        return directResult;
      }

      // 4. Search CoinGecko for the token
      const searchResult = await this.searchAndGetBestMatch(symbol);
      if (searchResult) {
        // Cache the discovered ID
        discoveredTokens.set(symbol, searchResult.id);
        return await this.getPriceById(searchResult.id);
      }

      return null;
    } catch (error) {
      logger.debug({ symbol: symbolOrAddress, error }, 'Failed to get price');
      return null;
    }
  }

  private async getPriceById(coinId: string): Promise<PriceData | null> {
    try {
      const url = `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const data = await this.fetchWithTimeout<CoinGeckoCoinInfo>(url, {
        headers: this.getHeaders(),
      });

      if (!data.market_data?.current_price?.usd) {
        return null;
      }

      return {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        price: data.market_data.current_price.usd,
        priceChange24h: data.market_data.price_change_24h ?? 0,
        priceChangePercent24h: data.market_data.price_change_percentage_24h ?? 0,
        marketCap: data.market_data.market_cap?.usd ?? 0,
        volume24h: data.market_data.total_volume?.usd ?? 0,
        high24h: data.market_data.high_24h?.usd ?? 0,
        low24h: data.market_data.low_24h?.usd ?? 0,
        lastUpdated: data.last_updated ? new Date(data.last_updated) : new Date(),
      };
    } catch {
      return null;
    }
  }

  private async searchAndGetBestMatch(query: string): Promise<{ id: string; symbol: string } | null> {
    try {
      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
      const data = await this.fetchWithTimeout<CoinGeckoSearchResult>(url, {
        headers: this.getHeaders(),
      });

      if (!data.coins || data.coins.length === 0) {
        return null;
      }

      // Find best match:
      // 1. Exact symbol match with highest market cap rank
      // 2. Otherwise, first result (highest relevance)
      const normalizedQuery = query.toUpperCase();

      // Sort by market cap rank (lower is better, null goes to end)
      const sortedCoins = data.coins.sort((a, b) => {
        if (a.market_cap_rank === null && b.market_cap_rank === null) return 0;
        if (a.market_cap_rank === null) return 1;
        if (b.market_cap_rank === null) return -1;
        return a.market_cap_rank - b.market_cap_rank;
      });

      // First, try to find exact symbol match
      const exactMatch = sortedCoins.find(
        coin => coin.symbol.toUpperCase() === normalizedQuery
      );

      if (exactMatch) {
        return { id: exactMatch.id, symbol: exactMatch.symbol };
      }

      // Otherwise return the first result
      const firstCoin = sortedCoins[0];
      return { id: firstCoin.id, symbol: firstCoin.symbol };
    } catch {
      return null;
    }
  }

  private async getPriceByContract(address: string, chain: SupportedChain): Promise<PriceData | null> {
    const platformId = CHAIN_CONFIG[chain].coingeckoId;

    try {
      const url = `${this.baseUrl}/coins/${platformId}/contract/${address.toLowerCase()}`;
      const data = await this.fetchWithTimeout<CoinGeckoCoinInfo>(url, {
        headers: this.getHeaders(),
      });

      if (!data.market_data?.current_price?.usd) {
        return null;
      }

      // Cache the discovered token
      discoveredTokens.set(data.symbol.toUpperCase(), data.id);

      return {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        price: data.market_data.current_price.usd,
        priceChange24h: data.market_data.price_change_24h ?? 0,
        priceChangePercent24h: data.market_data.price_change_percentage_24h ?? 0,
        marketCap: data.market_data.market_cap?.usd ?? 0,
        volume24h: data.market_data.total_volume?.usd ?? 0,
        high24h: data.market_data.high_24h?.usd ?? 0,
        low24h: data.market_data.low_24h?.usd ?? 0,
        lastUpdated: data.last_updated ? new Date(data.last_updated) : new Date(),
        chain,
        address: address.toLowerCase(),
      };
    } catch {
      return null;
    }
  }

  async searchToken(query: string): Promise<TokenInfo[]> {
    try {
      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
      const data = await this.fetchWithTimeout<CoinGeckoSearchResult>(url, {
        headers: this.getHeaders(),
      });

      return data.coins.slice(0, 10).map(coin => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        logoUrl: coin.thumb,
      }));
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
      const url = `${this.baseUrl}/ping`;
      await this.fetchWithTimeout<{ gecko_says: string }>(url, {
        headers: this.getHeaders(),
      }, 5000);
      return true;
    } catch {
      return false;
    }
  }
}
