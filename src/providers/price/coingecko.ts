import { BasePriceProvider } from './base.js';
import type { PriceData, TokenInfo } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { config, CHAIN_CONFIG } from '../../config/index.js';

interface CoinGeckoSearchResult {
  coins: Array<{
    id: string;
    symbol: string;
    name: string;
    thumb: string;
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

// Mapping common symbols to CoinGecko IDs
const SYMBOL_TO_ID: Record<string, string> = {
  // Major coins
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
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XLM: 'stellar',
  ETC: 'ethereum-classic',
  FIL: 'filecoin',
  APE: 'apecoin',
  PEPE: 'pepe',
  ARB: 'arbitrum',
  OP: 'optimism',
  NEAR: 'near',
  APT: 'aptos',
  SUI: 'sui',
  // Solana ecosystem
  PENGU: 'pudgy-penguins',
  PENGUIN: 'pudgy-penguins',
  BONK: 'bonk',
  WIF: 'dogwifcoin',
  JTO: 'jito-governance-token',
  JUP: 'jupiter-exchange-solana',
  PYTH: 'pyth-network',
  RAY: 'raydium',
  ORCA: 'orca',
  MNGO: 'mango-markets',
  SAMO: 'samoyedcoin',
  FIDA: 'bonfida',
  // Memecoins
  FLOKI: 'floki',
  WOJAK: 'wojak',
  BRETT: 'brett',
  MOG: 'mog-coin',
  POPCAT: 'popcat',
  // AI tokens
  FET: 'fetch-ai',
  RNDR: 'render-token',
  AGIX: 'singularitynet',
  OCEAN: 'ocean-protocol',
  TAO: 'bittensor',
  // Gaming
  IMX: 'immutable-x',
  GALA: 'gala',
  AXS: 'axie-infinity',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  // DeFi
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  SNX: 'havven',
  COMP: 'compound-governance-token',
  SUSHI: 'sushi',
  CAKE: 'pancakeswap-token',
};

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

      // Try to get by symbol
      const symbol = this.normalizeSymbol(symbolOrAddress);
      const coinId = SYMBOL_TO_ID[symbol] || symbol.toLowerCase();

      return await this.getPriceById(coinId, symbol);
    } catch (error) {
      return null;
    }
  }

  private async getPriceById(coinId: string, symbol: string): Promise<PriceData | null> {
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
      // Try searching for the coin
      const searchResults = await this.searchToken(symbol);
      if (searchResults.length > 0) {
        const firstResult = searchResults[0];
        // Recursively get price using found ID
        return await this.getPriceById(firstResult.symbol.toLowerCase(), firstResult.symbol);
      }
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
      // Check if enough time has passed for retry
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
