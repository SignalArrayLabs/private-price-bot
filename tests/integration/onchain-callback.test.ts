import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleCallback } from '../../src/bot/handlers/callbacks.js';
import type { Context } from 'grammy';
import * as onchainMovers from '../../src/providers/movers/dexscreener.js';
import * as majorsMovers from '../../src/providers/movers/coingecko.js';

describe('On-chain Callback Integration', () => {
  let mockCtx: Partial<Context>;
  let editMessageTextCalls: any[];
  let answerCallbackQueryCalls: any[];

  beforeEach(() => {
    editMessageTextCalls = [];
    answerCallbackQueryCalls = [];

    mockCtx = {
      chat: { id: 123, type: 'private' },
      callbackQuery: {
        id: 'callback-123',
        from: { id: 456, first_name: 'Test', is_bot: false },
        chat_instance: 'test',
        data: '', // Will be set per test
      },
      editMessageText: vi.fn(async (text, options) => {
        editMessageTextCalls.push({ text, options });
        return {} as any;
      }),
      answerCallbackQuery: vi.fn(async (options) => {
        answerCallbackQueryCalls.push(options);
        return true;
      }),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PROOF: On-chain button calls getOnChainGainers, NOT getTopGainers', async () => {
    mockCtx.callbackQuery!.data = 'gainers:5:onchain';

    // Spy on both providers
    const onchainSpy = vi.spyOn(onchainMovers, 'getOnChainGainers').mockResolvedValue([
      {
        id: 'onchain1',
        symbol: 'ONCHAIN1',
        name: 'OnChain Token 1',
        price: 1.5,
        priceChangePercent24h: 15,
        marketCap: 1000000,
        volume24h: 50000,
      },
    ]);

    const majorsSpy = vi.spyOn(majorsMovers, 'getTopGainers').mockResolvedValue([
      {
        id: 'major1',
        symbol: 'BTC',
        name: 'Bitcoin',
        price: 50000,
        priceChangePercent24h: 5,
        marketCap: 1000000000000,
        volume24h: 50000000000,
      },
    ]);

    await handleCallback(mockCtx as Context);

    // PROOF A: getOnChainGainers was called
    expect(onchainSpy).toHaveBeenCalledWith(5);

    // PROOF B: getTopGainers was NOT called
    expect(majorsSpy).not.toHaveBeenCalled();

    // PROOF C: Response contains "DexScreener (On-chain)" source label
    expect(editMessageTextCalls.length).toBeGreaterThan(0);
    const responseText = editMessageTextCalls[0].text;
    expect(responseText).toContain('DexScreener (On-chain)');
    expect(responseText).not.toContain('CoinGecko');
    expect(responseText).not.toContain('Majors');

    // PROOF D: Response contains on-chain token, not majors token
    expect(responseText).toContain('ONCHAIN1');
    expect(responseText).not.toContain('BTC');
  });

  it('PROOF: Majors button calls getTopGainers, NOT getOnChainGainers', async () => {
    mockCtx.callbackQuery!.data = 'gainers:5:majors';

    const onchainSpy = vi.spyOn(onchainMovers, 'getOnChainGainers').mockResolvedValue([]);
    const majorsSpy = vi.spyOn(majorsMovers, 'getTopGainers').mockResolvedValue([
      {
        id: 'btc',
        symbol: 'BTC',
        name: 'Bitcoin',
        price: 50000,
        priceChangePercent24h: 5,
        marketCap: 1000000000000,
        volume24h: 50000000000,
      },
    ]);

    await handleCallback(mockCtx as Context);

    // PROOF: getTopGainers was called, NOT getOnChainGainers
    expect(majorsSpy).toHaveBeenCalledWith(5);
    expect(onchainSpy).not.toHaveBeenCalled();

    // PROOF: Response contains "CoinGecko (Majors)" label
    const responseText = editMessageTextCalls[0].text;
    expect(responseText).toContain('CoinGecko (Majors)');
    expect(responseText).toContain('BTC');
  });

  it('PROOF: On-chain losers button calls getOnChainLosers', async () => {
    mockCtx.callbackQuery!.data = 'losers:5:onchain';

    const onchainSpy = vi.spyOn(onchainMovers, 'getOnChainLosers').mockResolvedValue([
      {
        id: 'loser1',
        symbol: 'LOSER1',
        name: 'Loser Token',
        price: 0.5,
        priceChangePercent24h: -20,
        marketCap: 100000,
        volume24h: 5000,
      },
    ]);

    const majorsSpy = vi.spyOn(majorsMovers, 'getTopLosers').mockResolvedValue([]);

    await handleCallback(mockCtx as Context);

    expect(onchainSpy).toHaveBeenCalledWith(5);
    expect(majorsSpy).not.toHaveBeenCalled();

    const responseText = editMessageTextCalls[0].text;
    expect(responseText).toContain('DexScreener (On-chain)');
    expect(responseText).toContain('LOSER1');
  });

  it('callback query is answered to prevent loading spinner', async () => {
    mockCtx.callbackQuery!.data = 'gainers:5:onchain';

    vi.spyOn(onchainMovers, 'getOnChainGainers').mockResolvedValue([
      {
        id: 'test',
        symbol: 'TEST',
        name: 'Test',
        price: 1,
        priceChangePercent24h: 10,
        marketCap: 100000,
        volume24h: 5000,
      },
    ]);

    await handleCallback(mockCtx as Context);

    // Callback query must be answered to stop loading spinner
    expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
  });
});
