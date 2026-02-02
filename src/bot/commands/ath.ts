import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getATHData } from '../../providers/price/index.js';
import { formatATHCard, formatNotFound, formatError } from '../../utils/format.js';
import { parseATHArgs } from '../../utils/validation.js';

export async function handleATH(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/ath &lt;symbol&gt;\n\n<b>Examples:</b>\n/ath BTC\n/ath ETH\n/ath SOL',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const parsed = parseATHArgs(args);
  if (!parsed) {
    await ctx.reply(formatError('Invalid symbol format.'), { parse_mode: 'HTML' });
    return;
  }

  await ctx.replyWithChatAction('typing');

  try {
    const athData = await getATHData(parsed.symbol);

    if (!athData) {
      await ctx.reply(formatNotFound(parsed.symbol), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `ath:${parsed.symbol}`)
      .text('📊 Price', `price:${parsed.symbol}:`);

    await ctx.reply(formatATHCard(athData), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch ATH data. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}
