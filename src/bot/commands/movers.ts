import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getTopGainers, getTopLosers } from '../../providers/movers/coingecko.js';
import { formatGainersCard, formatLosersCard, formatError } from '../../utils/format.js';
import { parseMoversArgs } from '../../utils/validation.js';

export async function handleGainers(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  const parsed = parseMoversArgs(args);

  await ctx.replyWithChatAction('typing');

  try {
    const tokens = await getTopGainers(parsed.limit);

    if (tokens.length === 0) {
      await ctx.reply(
        formatError('Failed to fetch top gainers. Please try again later.'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Build keyboard
    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `gainers:${parsed.limit}`)
      .text('📉 Losers', `losers:${parsed.limit}`);

    // Add price buttons for top 3
    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.reply(formatGainersCard(tokens), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch top gainers. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}

export async function handleLosers(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  const parsed = parseMoversArgs(args);

  await ctx.replyWithChatAction('typing');

  try {
    const tokens = await getTopLosers(parsed.limit);

    if (tokens.length === 0) {
      await ctx.reply(
        formatError('Failed to fetch top losers. Please try again later.'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Build keyboard
    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `losers:${parsed.limit}`)
      .text('🚀 Gainers', `gainers:${parsed.limit}`);

    // Add price buttons for top 3
    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.reply(formatLosersCard(tokens), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch top losers. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}
