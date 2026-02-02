import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getFearGreedIndex } from '../../providers/sentiment/alternativeme.js';
import { formatFGICard, formatError } from '../../utils/format.js';

export async function handleFGI(ctx: Context): Promise<void> {
  await ctx.replyWithChatAction('typing');

  try {
    const fgiData = await getFearGreedIndex();

    if (!fgiData) {
      await ctx.reply(
        formatError('Failed to fetch Fear & Greed Index. Please try again later.'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', 'fgi:refresh');

    await ctx.reply(formatFGICard(fgiData), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch Fear & Greed Index. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}
