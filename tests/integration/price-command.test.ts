import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePrice } from '../../src/bot/commands/price.js';
import type { Context } from 'grammy';
import * as priceIndex from '../../src/providers/price/index.js';
import type { PriceData } from '../../src/types/index.js';

describe('Price Command Integration', () => {
  let mockCtx: Partial<Context>;
  let replyCalls: any[];

  beforeEach(() => {
    replyCalls = [];

    mockCtx = {
      chat: { id: 123, type: 'private' },
      message: {
        text: '/p PENGU',
        message_id: 1,
        date: Date.now() / 1000,
        chat: { id: 123, type: 'private' },
      },
      reply: vi.fn(async (text, options) => {
        replyCalls.push({ text, options });
        return {} as any;
      }),
      replyWithChatAction: vi.fn(),
    };

    // Mock the getPrice function to return test data
    const mockPriceData: PriceData = {
      symbol: 'PENGU',
      name: 'Pudgy Penguins',
      price: 0.007797,
      priceChange24h: 0.000261,
      priceChangePercent24h: 3.53,
      marketCap: 490162871,
      volume24h: 791339, // Aggregated from real pairs
      high24h: 0,
      low24h: 0,
      lastUpdated: new Date(),
      address: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
      dexScreenerUrl: 'https://dexscreener.com/solana/B4Vwozy1FGtp8SELXSXydWSzavPUGnJ77DURV2k4MhUV',
    };

    vi.spyOn(priceIndex, 'getPrice').mockResolvedValue(mockPriceData);
  });

  it('includes DexScreener link in response', async () => {
    await handlePrice(mockCtx as Context);

    expect(replyCalls.length).toBeGreaterThan(0);
    const lastReply = replyCalls[replyCalls.length - 1];

    expect(lastReply.text).toContain('View on DexScreener');
    expect(lastReply.text).toContain('dexscreener.com');
    expect(lastReply.options.parse_mode).toBe('HTML');
  });

  it('includes bottom navigation keyboard', async () => {
    await handlePrice(mockCtx as Context);

    const lastReply = replyCalls[replyCalls.length - 1];
    const keyboard = lastReply.options.reply_markup;

    expect(keyboard).toBeDefined();

    // Check that keyboard has the expected structure
    const keyboardJson = JSON.stringify(keyboard);

    // Should have nav buttons
    expect(keyboardJson).toContain('nav:price');
    expect(keyboardJson).toContain('nav:gainers');
    expect(keyboardJson).toContain('nav:losers');
    expect(keyboardJson).toContain('nav:scan');
    expect(keyboardJson).toContain('nav:alerts');
    expect(keyboardJson).toContain('nav:leaderboard');

    // Should have action buttons
    expect(keyboardJson).toContain('🔄 Refresh');
    expect(keyboardJson).toContain('🔔 Set Alert');
  });

  it('shows volume in K/M/B format for PENGU', async () => {
    await handlePrice(mockCtx as Context);

    const lastReply = replyCalls[replyCalls.length - 1];

    // Volume should be formatted with K/M/B suffix, not raw small numbers
    expect(lastReply.text).toMatch(/\d+\.\d{2}[KMB]/);
    // Should NOT show single digit volume like "$3.99"
    expect(lastReply.text).not.toMatch(/Volume:.*\$\d\.\d{2}(?![KMB])/);
  });

  it('handles symbol not found gracefully', async () => {
    vi.spyOn(priceIndex, 'getPrice').mockResolvedValue(null);

    await handlePrice(mockCtx as Context);

    const lastReply = replyCalls[replyCalls.length - 1];
    expect(lastReply.text).toContain('Not Found');
  });

  it('handles API errors gracefully', async () => {
    vi.spyOn(priceIndex, 'getPrice').mockRejectedValue(new Error('Network error'));

    await handlePrice(mockCtx as Context);

    const lastReply = replyCalls[replyCalls.length - 1];
    expect(lastReply.text).toContain('Failed to fetch');
  });

  it('shows usage when no args provided', async () => {
    mockCtx.message!.text = '/p';

    await handlePrice(mockCtx as Context);

    const lastReply = replyCalls[replyCalls.length - 1];
    expect(lastReply.text).toContain('Usage:');
    expect(lastReply.text).toContain('/p');
  });
});
