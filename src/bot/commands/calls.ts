import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import {
  getOrCreateGroup,
  getOrCreateUser,
  createCall,
  getRecentCalls,
  getLeaderboardStats,
} from '../../db/index.js';
import { getPrice } from '../../providers/price/index.js';
import {
  formatCallCard,
  formatCallsListCard,
  formatLeaderboardCard,
  formatError,
} from '../../utils/format.js';
import { parseCallArgs } from '../../utils/validation.js';
import type { LeaderboardEntry, Call } from '../../types/index.js';

export async function handleCall(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const username = ctx.from?.username;

  if (!chatId || !userId) return;

  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/call &lt;symbol|address&gt; [entry_price]\n\n' +
      '<b>Examples:</b>\n/call PEPE\n/call BTC 67000',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const parsed = parseCallArgs(args);
  if (!parsed) {
    await ctx.reply(formatError('Invalid symbol or address format.'), { parse_mode: 'HTML' });
    return;
  }

  // Get or create entities
  const group = getOrCreateGroup(chatId, ctx.chat?.title);
  const user = getOrCreateUser(userId, username);

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  // Get current price if entry price not provided
  let entryPrice = parsed.entryPrice;
  if (!entryPrice) {
    try {
      const priceData = await getPrice(parsed.symbolOrAddress);
      if (priceData) {
        entryPrice = priceData.price;
      }
    } catch {
      // Will use 0 if we can't get price
    }
  }

  if (!entryPrice || entryPrice <= 0) {
    await ctx.reply(
      formatError('Could not determine entry price. Please specify: /call <symbol> <price>'),
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Create call
  const call = createCall(
    group.id,
    user.id,
    parsed.symbolOrAddress,
    entryPrice
  );

  // Get current price for display
  let currentPrice: number | undefined;
  try {
    const priceData = await getPrice(parsed.symbolOrAddress);
    currentPrice = priceData?.price;
  } catch {
    // Current price is optional for display
  }

  const keyboard = new InlineKeyboard()
    .text('📊 Price', `price:${parsed.symbolOrAddress}:`)
    .text('🔍 Scan', `scan:${parsed.symbolOrAddress}:ethereum`);

  await ctx.reply(formatCallCard({ ...call, username: user.username }, currentPrice), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleCalls(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Get or create group
  const group = getOrCreateGroup(chatId, ctx.chat?.title);

  // Get recent calls
  const calls = getRecentCalls(group.id, 10);

  // Enrich calls with current prices and multiples
  const enrichedCalls: Call[] = [];
  const priceCache = new Map<string, number>();

  for (const call of calls) {
    let currentPrice = priceCache.get(call.tokenRef);

    if (currentPrice === undefined) {
      try {
        const priceData = await getPrice(call.tokenRef, call.chain ?? undefined);
        if (priceData) {
          currentPrice = priceData.price;
          priceCache.set(call.tokenRef, currentPrice);
        }
      } catch {
        // Skip if price fetch fails
      }
    }

    enrichedCalls.push({
      ...call,
      currentPrice,
      multiple: currentPrice ? currentPrice / call.callPrice : undefined,
    });
  }

  await ctx.reply(formatCallsListCard(enrichedCalls), { parse_mode: 'HTML' });
}

export async function handleLeaderboard(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Get or create group
  const group = getOrCreateGroup(chatId, ctx.chat?.title);

  // Get leaderboard stats from DB
  const stats = getLeaderboardStats(group.id);

  // Get recent calls to calculate multiples
  const calls = getRecentCalls(group.id, 100);

  // Calculate actual multiples by fetching current prices
  const priceCache = new Map<string, number>();
  const userMultiples = new Map<number, number[]>();

  for (const call of calls) {
    let currentPrice = priceCache.get(call.tokenRef);

    if (currentPrice === undefined) {
      try {
        const priceData = await getPrice(call.tokenRef, call.chain ?? undefined);
        if (priceData) {
          currentPrice = priceData.price;
          priceCache.set(call.tokenRef, currentPrice);
        }
      } catch {
        continue;
      }
    }

    if (currentPrice) {
      const multiple = currentPrice / call.callPrice;
      const existing = userMultiples.get(call.userId) ?? [];
      existing.push(multiple);
      userMultiples.set(call.userId, existing);
    }
  }

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = stats.map(stat => {
    const multiples = userMultiples.get(stat.userId) ?? [];
    const avgMultiple = multiples.length > 0
      ? multiples.reduce((a, b) => a + b, 0) / multiples.length
      : 0;
    const bestMultiple = multiples.length > 0 ? Math.max(...multiples) : 0;
    const winRate = multiples.length > 0
      ? multiples.filter(m => m >= 1).length / multiples.length
      : 0;

    return {
      userId: stat.userId,
      username: stat.username,
      totalCalls: stat.totalCalls,
      avgMultiple,
      bestMultiple,
      winRate,
    };
  });

  // Sort by best multiple
  entries.sort((a, b) => b.bestMultiple - a.bestMultiple);

  await ctx.reply(formatLeaderboardCard(entries), { parse_mode: 'HTML' });
}
