import { describe, it, expect } from 'vitest';
import {
  parseGasArgs,
  parseConvertArgs,
  parseATHArgs,
  parseMoversArgs,
} from '../../src/utils/validation.js';
import {
  formatGasCard,
  formatTrendingCard,
  formatConvertCard,
  formatATHCard,
  formatFGICard,
  formatGainersCard,
  formatLosersCard,
} from '../../src/utils/format.js';
import type {
  GasData,
  TrendingToken,
  ConvertResult,
  ATHData,
  FearGreedData,
  MoverToken,
} from '../../src/types/index.js';

describe('New Feature Validation', () => {
  describe('parseGasArgs', () => {
    it('returns ethereum by default with no args', () => {
      const result = parseGasArgs([]);
      expect(result).toEqual({ chain: 'ethereum' });
    });

    it('parses ethereum chain', () => {
      const result = parseGasArgs(['ethereum']);
      expect(result).toEqual({ chain: 'ethereum' });
    });

    it('parses bsc chain', () => {
      const result = parseGasArgs(['bsc']);
      expect(result).toEqual({ chain: 'bsc' });
    });

    it('parses polygon chain', () => {
      const result = parseGasArgs(['polygon']);
      expect(result).toEqual({ chain: 'polygon' });
    });

    it('handles eth alias', () => {
      const result = parseGasArgs(['eth']);
      expect(result).toEqual({ chain: 'ethereum' });
    });

    it('handles bnb alias', () => {
      const result = parseGasArgs(['bnb']);
      expect(result).toEqual({ chain: 'bsc' });
    });

    it('defaults to ethereum for invalid chain', () => {
      const result = parseGasArgs(['invalid']);
      expect(result).toEqual({ chain: 'ethereum' });
    });
  });

  describe('parseConvertArgs', () => {
    it('parses valid conversion args', () => {
      const result = parseConvertArgs(['1', 'BTC', 'ETH']);
      expect(result).toEqual({
        amount: 1,
        fromSymbol: 'BTC',
        toSymbol: 'ETH',
      });
    });

    it('parses amount with decimal', () => {
      const result = parseConvertArgs(['0.5', 'ETH', 'USD']);
      expect(result).toEqual({
        amount: 0.5,
        fromSymbol: 'ETH',
        toSymbol: 'USD',
      });
    });

    it('parses amount with commas', () => {
      const result = parseConvertArgs(['1,000', 'USD', 'BTC']);
      expect(result).toEqual({
        amount: 1000,
        fromSymbol: 'USD',
        toSymbol: 'BTC',
      });
    });

    it('parses amount with dollar sign', () => {
      const result = parseConvertArgs(['$100', 'USD', 'ETH']);
      expect(result).toEqual({
        amount: 100,
        fromSymbol: 'USD',
        toSymbol: 'ETH',
      });
    });

    it('returns null for missing args', () => {
      expect(parseConvertArgs(['1', 'BTC'])).toBe(null);
      expect(parseConvertArgs(['1'])).toBe(null);
      expect(parseConvertArgs([])).toBe(null);
    });

    it('returns null for invalid amount', () => {
      expect(parseConvertArgs(['abc', 'BTC', 'ETH'])).toBe(null);
      expect(parseConvertArgs(['-1', 'BTC', 'ETH'])).toBe(null);
    });

    it('returns null for invalid symbol', () => {
      expect(parseConvertArgs(['1', 'invalid$', 'ETH'])).toBe(null);
    });
  });

  describe('parseATHArgs', () => {
    it('parses valid symbol', () => {
      const result = parseATHArgs(['BTC']);
      expect(result).toEqual({ symbol: 'BTC' });
    });

    it('parses lowercase symbol', () => {
      const result = parseATHArgs(['eth']);
      expect(result).toEqual({ symbol: 'eth' });
    });

    it('returns null for no args', () => {
      expect(parseATHArgs([])).toBe(null);
    });

    it('returns null for invalid symbol', () => {
      expect(parseATHArgs(['invalid$'])).toBe(null);
    });
  });

  describe('parseMoversArgs', () => {
    it('returns default limit with no args', () => {
      const result = parseMoversArgs([]);
      expect(result).toEqual({ limit: 5, category: 'majors' });
    });

    it('parses valid limit', () => {
      const result = parseMoversArgs(['3']);
      expect(result).toEqual({ limit: 3, category: 'majors' });
    });

    it('caps limit at 10', () => {
      const result = parseMoversArgs(['15']);
      expect(result).toEqual({ limit: 10, category: 'majors' });
    });

    it('returns default for invalid limit', () => {
      const result = parseMoversArgs(['abc']);
      expect(result).toEqual({ limit: 5, category: 'majors' });
    });

    it('returns default for negative limit', () => {
      const result = parseMoversArgs(['-5']);
      expect(result).toEqual({ limit: 5, category: 'majors' });
    });
  });
});

describe('New Feature Formatting', () => {
  describe('formatGasCard', () => {
    it('formats gas data correctly', () => {
      const data: GasData = {
        chain: 'ethereum',
        low: 15,
        average: 20,
        fast: 30,
        baseFee: 12.5,
        lastBlock: 19234567,
        lastUpdated: new Date(),
      };

      const result = formatGasCard(data);

      expect(result).toContain('Gas Prices - Ethereum');
      expect(result).toContain('Low:</b> 15 GWEI');
      expect(result).toContain('Average:</b> 20 GWEI');
      expect(result).toContain('Fast:</b> 30 GWEI');
      expect(result).toContain('Base Fee:</b> 12.50 GWEI');
      expect(result).toContain('Block:</b>');
    });

    it('handles missing optional fields', () => {
      const data: GasData = {
        chain: 'bsc',
        low: 5,
        average: 5,
        fast: 5,
        lastUpdated: new Date(),
      };

      const result = formatGasCard(data);

      expect(result).toContain('Gas Prices - Bsc');
      expect(result).not.toContain('Base Fee');
      expect(result).not.toContain('Block');
    });
  });

  describe('formatTrendingCard', () => {
    it('formats trending tokens correctly', () => {
      const tokens: TrendingToken[] = [
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', marketCapRank: 1, priceChangePercent24h: 5.5 },
        { id: 'ethereum', symbol: 'eth', name: 'Ethereum', marketCapRank: 2, priceChangePercent24h: -2.3 },
      ];

      const result = formatTrendingCard(tokens);

      expect(result).toContain('Trending on CoinGecko');
      expect(result).toContain('BTC');
      expect(result).toContain('Bitcoin');
      expect(result).toContain('#1');
      expect(result).toContain('+5.50%');
    });

    it('handles empty tokens', () => {
      const result = formatTrendingCard([]);
      expect(result).toContain('No trending data available');
    });
  });

  describe('formatConvertCard', () => {
    it('formats conversion result correctly', () => {
      const data: ConvertResult = {
        amount: 1,
        fromSymbol: 'BTC',
        toSymbol: 'ETH',
        fromPrice: 67000,
        toPrice: 4000,
        result: 16.75,
        rate: 16.75,
      };

      const result = formatConvertCard(data);

      expect(result).toContain('Currency Conversion');
      expect(result).toContain('1 BTC');
      expect(result).toContain('ETH');
      expect(result).toContain('Rates');
    });
  });

  describe('formatATHCard', () => {
    it('formats ATH data correctly', () => {
      const data: ATHData = {
        symbol: 'BTC',
        name: 'Bitcoin',
        currentPrice: 67234.56,
        ath: 69000,
        athChangePercent: -2.56,
        athDate: new Date('2021-11-10'),
      };

      const result = formatATHCard(data);

      expect(result).toContain('All-Time High - Bitcoin');
      expect(result).toContain('Current:');
      expect(result).toContain('ATH:');
      expect(result).toContain('ATH Date:');
      expect(result).toContain('From ATH:');
      expect(result).toContain('-2.56%');
    });
  });

  describe('formatFGICard', () => {
    it('formats fear greed index correctly', () => {
      const data: FearGreedData = {
        value: 72,
        classification: 'Greed',
        timestamp: new Date(),
        previousValue: 68,
        previousClassification: 'Greed',
      };

      const result = formatFGICard(data);

      expect(result).toContain('Fear & Greed Index');
      expect(result).toContain('72');
      expect(result).toContain('Greed');
      expect(result).toContain('Yesterday:');
      expect(result).toContain('68');
    });

    it('handles extreme fear', () => {
      const data: FearGreedData = {
        value: 10,
        classification: 'Extreme Fear',
        timestamp: new Date(),
      };

      const result = formatFGICard(data);
      expect(result).toContain('10');
      expect(result).toContain('Extreme Fear');
    });

    it('handles extreme greed', () => {
      const data: FearGreedData = {
        value: 85,
        classification: 'Extreme Greed',
        timestamp: new Date(),
      };

      const result = formatFGICard(data);
      expect(result).toContain('85');
      expect(result).toContain('Extreme Greed');
    });
  });

  describe('formatGainersCard', () => {
    it('formats gainers correctly', () => {
      const tokens: MoverToken[] = [
        { id: 'pepe', symbol: 'pepe', name: 'Pepe', price: 0.00001234, priceChangePercent24h: 45.2, marketCap: 5200000000, volume24h: 1000000000 },
        { id: 'wif', symbol: 'wif', name: 'dogwifhat', price: 2.45, priceChangePercent24h: 32.1, marketCap: 2400000000, volume24h: 500000000 },
      ];

      const result = formatGainersCard(tokens);

      expect(result).toContain('Top Gainers');
      expect(result).toContain('PEPE');
      expect(result).toContain('+45.20%');
      expect(result).toContain('WIF');
    });

    it('handles empty tokens', () => {
      const result = formatGainersCard([]);
      expect(result).toContain('No data available');
    });
  });

  describe('formatLosersCard', () => {
    it('formats losers correctly', () => {
      const tokens: MoverToken[] = [
        { id: 'token1', symbol: 'tkn1', name: 'Token1', price: 1.5, priceChangePercent24h: -15.5, marketCap: 100000000, volume24h: 10000000 },
      ];

      const result = formatLosersCard(tokens);

      expect(result).toContain('Top Losers');
      expect(result).toContain('TKN1');
      expect(result).toContain('-15.50%');
    });

    it('handles empty tokens', () => {
      const result = formatLosersCard([]);
      expect(result).toContain('No data available');
    });
  });
});
