import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getTrendingTokens } from '../../providers/trending/coingecko.js';
import { formatTrendingCard, formatError } from '../../utils/format.js';

export async function handleTrending(ctx: Context): Promise<void> {
  await ctx.replyWithChatAction('typing');

  try {
    const tokens = await getTrendingTokens();

    if (tokens.length === 0) {
      await ctx.reply(
        formatError('Failed to fetch trending tokens. Please try again later.'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Build keyboard with price lookup buttons for top 3
    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', 'trending:refresh');

    // Add price buttons for top 3 tokens
    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.reply(formatTrendingCard(tokens), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch trending tokens. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}
