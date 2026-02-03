import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getPrice } from '../../providers/price/index.js';
import { getOrCreateGroup, getGroupDefault } from '../../db/index.js';
import { formatPriceCard, formatNotFound, formatError } from '../../utils/format.js';
import { parsePriceArgs } from '../../utils/validation.js';
import { getMentionArgs, isMentionCommand } from '../middleware/mention.js';
import { config } from '../../config/index.js';

export async function handlePrice(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Get args from command or mention
  let args: string[];
  if (isMentionCommand(ctx, 'p') || isMentionCommand(ctx, 'price')) {
    args = getMentionArgs(ctx);
  } else {
    const text = ctx.message?.text ?? '';
    args = text.split(/\s+/).slice(1);
  }

  // If no args, show usage
  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/p &lt;symbol|address&gt; [chain]\n\n<b>Examples:</b>\n/p BTC\n/p 0x... ethereum',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const parsed = parsePriceArgs(args);
  if (!parsed) {
    await ctx.reply(formatError('Invalid symbol or address format.'), { parse_mode: 'HTML' });
    return;
  }

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  try {
    console.log('[DEBUG] Fetching price for:', parsed.symbolOrAddress, 'chain:', parsed.chain);
    const priceData = await getPrice(parsed.symbolOrAddress, parsed.chain);
    console.log('[DEBUG] Price result:', priceData ? 'found' : 'null');

    if (!priceData) {
      await ctx.reply(formatNotFound(parsed.symbolOrAddress), { parse_mode: 'HTML' });
      return;
    }

    // Build inline keyboard
    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `refresh:${parsed.symbolOrAddress}:${parsed.chain ?? ''}`)
      .text('🔔 Set Alert', `alert:${parsed.symbolOrAddress}:${parsed.chain ?? ''}`);

    // Add security button if it's an address
    if (parsed.symbolOrAddress.startsWith('0x')) {
      keyboard.row().text('🔍 Security', `scan:${parsed.symbolOrAddress}:${parsed.chain ?? 'ethereum'}`);
    }

    // Add bottom navigation row
    keyboard.row()
      .text('💰 Price', 'nav:price')
      .text('🚀 Gainers', 'nav:gainers')
      .text('📉 Losers', 'nav:losers')
      .row()
      .text('🔍 Scan', 'nav:scan')
      .text('🔔 Alerts', 'nav:alerts')
      .text('🏆 Board', 'nav:leaderboard');

    await ctx.reply(formatPriceCard(priceData, config.priceProvider), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch price data. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}

export async function handleDefault(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Get group config
  const group = getOrCreateGroup(chatId, ctx.chat?.title);
  const defaultConfig = getGroupDefault(group.id);

  if (!defaultConfig.token) {
    await ctx.reply(
      '<b>No default token set.</b>\n\nUse /setdefault &lt;symbol&gt; to set one.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  try {
    const priceData = await getPrice(defaultConfig.token, defaultConfig.chain);

    if (!priceData) {
      await ctx.reply(formatNotFound(defaultConfig.token), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `refresh:${defaultConfig.token}:${defaultConfig.chain ?? ''}`);

    // Add bottom navigation row
    keyboard.row()
      .text('💰 Price', 'nav:price')
      .text('🚀 Gainers', 'nav:gainers')
      .text('📉 Losers', 'nav:losers')
      .row()
      .text('🔍 Scan', 'nav:scan')
      .text('🔔 Alerts', 'nav:alerts')
      .text('🏆 Board', 'nav:leaderboard');

    await ctx.reply(formatPriceCard(priceData, config.priceProvider), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch price data. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}

export async function handleChart(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/chart &lt;symbol&gt;\n\n<b>Example:</b>\n/chart BTC',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const symbol = args[0].toUpperCase();

  // Generate chart links
  const coingeckoChart = `https://www.coingecko.com/en/coins/${symbol.toLowerCase()}`;
  const tradingViewChart = `https://www.tradingview.com/chart/?symbol=${symbol}USD`;
  const dexscreenerChart = `https://dexscreener.com/search?q=${symbol}`;

  const message = `<b>📈 Charts for ${symbol}</b>\n\n` +
    `• <a href="${coingeckoChart}">CoinGecko</a>\n` +
    `• <a href="${tradingViewChart}">TradingView</a>\n` +
    `• <a href="${dexscreenerChart}">DexScreener</a>`;

  await ctx.reply(message, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}
