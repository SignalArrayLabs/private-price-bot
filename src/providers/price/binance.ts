import { BasePriceProvider } from './base.js';
import type { PriceData, TokenInfo } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';

interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

// Major pairs supported by Binance with USDT
const SUPPORTED_PAIRS = new Set([
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'SHIB',
  'LTC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'XLM', 'ETC', 'FIL', 'APE', 'PEPE',
  'ARB', 'OP', 'NEAR', 'APT', 'SUI', 'INJ', 'FET', 'RNDR', 'GRT', 'IMX',
  'WLD', 'SEI', 'TIA', 'JUP', 'STX', 'RUNE', 'MKR', 'AAVE', 'SNX', 'CRV',
]);

export class BinanceProvider extends BasePriceProvider {
  name = 'Binance';
  private baseUrl = 'https://api.binance.com/api/v3';

  async getPrice(symbolOrAddress: string, _chain?: SupportedChain): Promise<PriceData | null> {
    // Binance doesn't support contract addresses
    if (this.isAddress(symbolOrAddress)) {
      return null;
    }

    const symbol = this.normalizeSymbol(symbolOrAddress);

    // Only support major pairs
    if (!SUPPORTED_PAIRS.has(symbol)) {
      return null;
    }

    const pair = `${symbol}USDT`;

    try {
      const url = `${this.baseUrl}/ticker/24hr?symbol=${pair}`;
      const ticker = await this.fetchWithTimeout<BinanceTicker>(url);

      const price = parseFloat(ticker.lastPrice);
      const priceChange = parseFloat(ticker.priceChange);
      const priceChangePercent = parseFloat(ticker.priceChangePercent);
      const volume = parseFloat(ticker.quoteVolume);
      const high = parseFloat(ticker.highPrice);
      const low = parseFloat(ticker.lowPrice);

      return {
        symbol,
        name: symbol, // Binance doesn't provide full names
        price,
        priceChange24h: priceChange,
        priceChangePercent24h: priceChangePercent,
        marketCap: 0, // Binance doesn't provide market cap
        volume24h: volume,
        high24h: high,
        low24h: low,
        lastUpdated: new Date(ticker.closeTime),
      };
    } catch {
      return null;
    }
  }

  async searchToken(query: string): Promise<TokenInfo[]> {
    const symbol = this.normalizeSymbol(query);

    // Return matching supported pairs
    const matches = Array.from(SUPPORTED_PAIRS)
      .filter(s => s.includes(symbol) || symbol.includes(s))
      .slice(0, 10)
      .map(s => ({
        symbol: s,
        name: s,
      }));

    return matches;
  }

  async isHealthy(): Promise<boolean> {
    if (this.isDown) {
      if (this.downSince && Date.now() - this.downSince.getTime() < this.backoffMs) {
        return false;
      }
    }

    try {
      const url = `${this.baseUrl}/ping`;
      await this.fetchWithTimeout<Record<string, never>>(url, {}, 5000);
      return true;
    } catch {
      return false;
    }
  }
}
