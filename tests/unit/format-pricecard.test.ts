import { describe, it, expect } from 'vitest';
import { formatPriceCard } from '../../src/utils/format.js';
import type { PriceData } from '../../src/types/index.js';

describe('formatPriceCard', () => {
  const mockPriceData: PriceData = {
    symbol: 'PENGU',
    name: 'Pudgy Penguins',
    price: 0.007797,
    priceChange24h: 0.000261,
    priceChangePercent24h: 3.53,
    marketCap: 490162871,
    volume24h: 12059920, // 12M aggregated
    high24h: 0,
    low24h: 0,
    lastUpdated: new Date(),
    address: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
    dexScreenerUrl: 'https://dexscreener.com/solana/B4Vwozy1FGtp8SELXSXydWSzavPUGnJ77DURV2k4MhUV',
  };

  it('includes DexScreener link when dexScreenerUrl is present', () => {
    const result = formatPriceCard(mockPriceData, 'DexScreener');

    expect(result).toContain('View on DexScreener');
    expect(result).toContain('https://dexscreener.com/solana/');
    expect(result).toContain('<a href=');
  });

  it('does not include DexScreener link when dexScreenerUrl is missing', () => {
    const dataWithoutUrl: PriceData = {
      ...mockPriceData,
      dexScreenerUrl: undefined,
    };

    const result = formatPriceCard(dataWithoutUrl, 'CoinGecko');

    expect(result).not.toContain('View on DexScreener');
    expect(result).not.toContain('dexscreener.com');
  });

  it('formats volume using K/M/B notation', () => {
    const result = formatPriceCard(mockPriceData, 'DexScreener');

    // 12059920 should be formatted as ~12.06M
    expect(result).toMatch(/12\.\d{2}M/);
  });

  it('includes all required price information', () => {
    const result = formatPriceCard(mockPriceData, 'DexScreener');

    expect(result).toContain('PENGU');
    // Note: formatPriceCard doesn't display the full name, only symbol
    expect(result).toContain('$0.007'); // Price
    expect(result).toContain('3.53%'); // Change
    expect(result).toContain('490.16M'); // Market cap
    expect(result).toContain('Source: DexScreener');
  });

  it('properly escapes HTML in symbol', () => {
    const dataWithSpecialChars: PriceData = {
      ...mockPriceData,
      symbol: 'TEST<>',
      name: 'Test & Token',
    };

    const result = formatPriceCard(dataWithSpecialChars, 'DexScreener');

    expect(result).toContain('TEST&lt;&gt;');
    // Name is not displayed in price card
  });
});
