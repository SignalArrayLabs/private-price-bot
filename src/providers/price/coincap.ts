import { BasePriceProvider } from './base.js';
import type { PriceData, TokenInfo } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';

interface CoinCapAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
}

interface CoinCapResponse {
  data: CoinCapAsset | CoinCapAsset[];
  timestamp: number;
}

interface CoinCapSearchResponse {
  data: CoinCapAsset[];
}

// Mapping common symbols to CoinCap IDs
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binance-coin',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'xrp',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'polygon',
  SHIB: 'shiba-inu',
  LTC: 'litecoin',
  AVAX: 'avalanche',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XLM: 'stellar',
  ETC: 'ethereum-classic',
  FIL: 'filecoin',
};

export class CoinCapProvider extends BasePriceProvider {
  name = 'CoinCap';
  private baseUrl = 'https://api.coincap.io/v2';

  async getPrice(symbolOrAddress: string, _chain?: SupportedChain): Promise<PriceData | null> {
    // CoinCap doesn't support contract addresses
    if (this.isAddress(symbolOrAddress)) {
      return null;
    }

    const symbol = this.normalizeSymbol(symbolOrAddress);
    const assetId = SYMBOL_TO_ID[symbol] || symbol.toLowerCase();

    try {
      const url = `${this.baseUrl}/assets/${assetId}`;
      const response = await this.fetchWithTimeout<CoinCapResponse>(url);

      const asset = response.data as CoinCapAsset;
      if (!asset || !asset.priceUsd) {
        return null;
      }

      const price = parseFloat(asset.priceUsd);
      const changePercent = parseFloat(asset.changePercent24Hr || '0');
      const priceChange = price * (changePercent / 100);

      return {
        symbol: asset.symbol.toUpperCase(),
        name: asset.name,
        price,
        priceChange24h: priceChange,
        priceChangePercent24h: changePercent,
        marketCap: parseFloat(asset.marketCapUsd || '0'),
        volume24h: parseFloat(asset.volumeUsd24Hr || '0'),
        high24h: 0, // CoinCap doesn't provide this
        low24h: 0, // CoinCap doesn't provide this
        lastUpdated: new Date(response.timestamp),
      };
    } catch {
      // Try searching
      const searchResults = await this.searchToken(symbol);
      if (searchResults.length > 0) {
        const firstId = SYMBOL_TO_ID[searchResults[0].symbol] || searchResults[0].symbol.toLowerCase();
        try {
          const url = `${this.baseUrl}/assets/${firstId}`;
          const response = await this.fetchWithTimeout<CoinCapResponse>(url);
          const asset = response.data as CoinCapAsset;

          if (asset && asset.priceUsd) {
            const price = parseFloat(asset.priceUsd);
            const changePercent = parseFloat(asset.changePercent24Hr || '0');

            return {
              symbol: asset.symbol.toUpperCase(),
              name: asset.name,
              price,
              priceChange24h: price * (changePercent / 100),
              priceChangePercent24h: changePercent,
              marketCap: parseFloat(asset.marketCapUsd || '0'),
              volume24h: parseFloat(asset.volumeUsd24Hr || '0'),
              high24h: 0,
              low24h: 0,
              lastUpdated: new Date(response.timestamp),
            };
          }
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  async searchToken(query: string): Promise<TokenInfo[]> {
    try {
      const url = `${this.baseUrl}/assets?search=${encodeURIComponent(query)}&limit=10`;
      const response = await this.fetchWithTimeout<CoinCapSearchResponse>(url);

      return response.data.map(asset => ({
        symbol: asset.symbol.toUpperCase(),
        name: asset.name,
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
      const url = `${this.baseUrl}/assets/bitcoin`;
      await this.fetchWithTimeout<CoinCapResponse>(url, {}, 5000);
      return true;
    } catch {
      return false;
    }
  }
}
