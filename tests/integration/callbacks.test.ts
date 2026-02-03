import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCallback } from '../../src/bot/handlers/callbacks.js';
import type { Context } from 'grammy';

describe('Callback Handlers Integration', () => {
  let mockCtx: Partial<Context>;
  let replyCalls: any[];
  let answerCallbackQueryCalls: any[];

  beforeEach(() => {
    replyCalls = [];
    answerCallbackQueryCalls = [];

    mockCtx = {
      chat: { id: 123, type: 'private' },
      callbackQuery: {
        id: 'callback-123',
        from: { id: 456, first_name: 'Test', is_bot: false },
        chat_instance: 'test',
        data: '',
      },
      reply: vi.fn(async (text, options) => {
        replyCalls.push({ text, options });
        return {} as any;
      }),
      answerCallbackQuery: vi.fn(async (options) => {
        answerCallbackQueryCalls.push(options);
        return true;
      }),
      editMessageText: vi.fn(),
    };

    // Mock DexScreener API for gainers/losers
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pairs: [
          {
            chainId: 'ethereum',
            dexId: 'uniswap',
            pairAddress: '0x123',
            baseToken: { address: '0xabc', name: 'Gainer Token', symbol: 'GAIN' },
            quoteToken: { symbol: 'WETH' },
            priceNative: '0.01',
            priceUsd: '10',
            txns: { h24: { buys: 100, sells: 100 } },
            volume: { h24: 50000 },
            priceChange: { h24: 50 },
            liquidity: { usd: 100000 },
            fdv: 10000000,
            marketCap: 5000000,
          },
        ],
      }),
    });
  });

  describe('nav callbacks', () => {
    it('handles nav:price callback', async () => {
      mockCtx.callbackQuery!.data = 'nav:price';

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      expect(replyCalls.length).toBeGreaterThan(0);

      const reply = replyCalls[0];
      expect(reply.text).toContain('Use: /p');
      expect(reply.text).toContain('symbol');
    });

    it('handles nav:gainers callback', async () => {
      mockCtx.callbackQuery!.data = 'nav:gainers';

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      // Should call editMessageText with gainers data (mocked above)
      expect(mockCtx.editMessageText).toHaveBeenCalled();
    });

    it('handles nav:losers callback', async () => {
      mockCtx.callbackQuery!.data = 'nav:losers';

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      expect(mockCtx.editMessageText).toHaveBeenCalled();
    });

    it('handles nav:scan callback', async () => {
      mockCtx.callbackQuery!.data = 'nav:scan';

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      expect(replyCalls.length).toBeGreaterThan(0);

      const reply = replyCalls[0];
      expect(reply.text).toContain('Use: /scan');
      expect(reply.text).toContain('address');
    });

    it('handles nav:alerts callback', async () => {
      mockCtx.callbackQuery!.data = 'nav:alerts';

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      expect(replyCalls.length).toBeGreaterThan(0);

      const reply = replyCalls[0];
      expect(reply.text).toContain('/alert');
    });

    it('handles nav:leaderboard callback', async () => {
      mockCtx.callbackQuery!.data = 'nav:leaderboard';

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      expect(replyCalls.length).toBeGreaterThan(0);

      const reply = replyCalls[0];
      expect(reply.text).toContain('/lb');
    });

    it('handles unknown callback action gracefully', async () => {
      mockCtx.callbackQuery!.data = 'unknown:action';

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      const answer = answerCallbackQueryCalls[0];
      expect(answer?.text || answer).toBeDefined();
    });
  });

  describe('refresh callback', () => {
    it('refreshes price data', async () => {
      mockCtx.callbackQuery!.data = 'refresh:PENGU:';

      // Mock successful price fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pairs: [
            {
              chainId: 'solana',
              dexId: 'raydium',
              pairAddress: '0x123',
              baseToken: { address: '0xabc', name: 'Pudgy Penguins', symbol: 'PENGU' },
              quoteToken: { symbol: 'SOL' },
              priceNative: '0.0001',
              priceUsd: '0.008',
              txns: { h24: { buys: 100, sells: 100 } },
              volume: { h24: 12000000 },
              priceChange: { h24: 3.5 },
              liquidity: { usd: 50000 },
              fdv: 500000000,
              marketCap: 400000000,
            },
          ],
        }),
      });

      await handleCallback(mockCtx as Context);

      expect(answerCallbackQueryCalls.length).toBeGreaterThan(0);
      expect(mockCtx.editMessageText).toHaveBeenCalled();
    });
  });
});
