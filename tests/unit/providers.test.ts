import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test the provider base class and mock responses
describe('Price Providers', () => {
  describe('CoinGecko Provider', () => {
    it('should handle successful price fetch', async () => {
      // Mock fetch
      const mockResponse = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          current_price: { usd: 67000 },
          price_change_24h: 1000,
          price_change_percentage_24h: 1.5,
          market_cap: { usd: 1320000000000 },
          total_volume: { usd: 28000000000 },
          high_24h: { usd: 68000 },
          low_24h: { usd: 65000 },
        },
        last_updated: '2024-01-15T12:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // Import after mocking
      const { CoinGeckoProvider } = await import('../../src/providers/price/coingecko.js');
      const provider = new CoinGeckoProvider();

      const result = await provider.getPrice('BTC');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('BTC');
      expect(result?.price).toBe(67000);
      expect(result?.priceChange24h).toBe(1000);
    });

    it('should return null for non-existent token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { CoinGeckoProvider } = await import('../../src/providers/price/coingecko.js');
      const provider = new CoinGeckoProvider();

      const result = await provider.getPrice('NONEXISTENT');
      expect(result).toBeNull();
    });
  });

  describe('CoinCap Provider', () => {
    it('should handle successful price fetch', async () => {
      const mockResponse = {
        data: {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          priceUsd: '67000',
          changePercent24Hr: '1.5',
          marketCapUsd: '1320000000000',
          volumeUsd24Hr: '28000000000',
        },
        timestamp: Date.now(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { CoinCapProvider } = await import('../../src/providers/price/coincap.js');
      const provider = new CoinCapProvider();

      const result = await provider.getPrice('BTC');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('BTC');
      expect(result?.price).toBe(67000);
    });

    it('should return null for contract addresses (not supported)', async () => {
      const { CoinCapProvider } = await import('../../src/providers/price/coincap.js');
      const provider = new CoinCapProvider();

      const result = await provider.getPrice('0x1234567890abcdef1234567890abcdef12345678');
      expect(result).toBeNull();
    });
  });

  describe('Binance Provider', () => {
    it('should handle successful price fetch for supported pairs', async () => {
      const mockResponse = {
        symbol: 'BTCUSDT',
        lastPrice: '67000',
        priceChange: '1000',
        priceChangePercent: '1.5',
        quoteVolume: '28000000000',
        highPrice: '68000',
        lowPrice: '65000',
        closeTime: Date.now(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { BinanceProvider } = await import('../../src/providers/price/binance.js');
      const provider = new BinanceProvider();

      const result = await provider.getPrice('BTC');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('BTC');
      expect(result?.price).toBe(67000);
    });

    it('should return null for unsupported pairs', async () => {
      const { BinanceProvider } = await import('../../src/providers/price/binance.js');
      const provider = new BinanceProvider();

      const result = await provider.getPrice('OBSCURETOKEN');
      expect(result).toBeNull();
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe('Security Providers', () => {
  describe('Etherscan Provider', () => {
    it('should analyze contract security', async () => {
      const mockSourceResponse = {
        status: '1',
        result: [{
          SourceCode: 'contract Test { function mint() {} function owner() {} }',
          ABI: '[{"name":"mint"},{"name":"owner"}]',
          ContractName: 'TestToken',
          Proxy: '0',
        }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSourceResponse),
      });

      const { EtherscanProvider } = await import('../../src/providers/security/etherscan.js');
      const provider = new EtherscanProvider();

      const result = await provider.getContractSecurity(
        '0x1234567890abcdef1234567890abcdef12345678',
        'ethereum'
      );

      expect(result).not.toBeNull();
      expect(result?.isVerified).toBe(true);
      expect(result?.hasMintFunction).toBe(true);
      expect(result?.hasOwnerFunction).toBe(true);
    });

    it('should return null for invalid address', async () => {
      const { EtherscanProvider } = await import('../../src/providers/security/etherscan.js');
      const provider = new EtherscanProvider();

      const result = await provider.getContractSecurity('invalid', 'ethereum');
      expect(result).toBeNull();
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
