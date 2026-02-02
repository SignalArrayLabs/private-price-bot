import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getPrice } from '../../providers/price/index.js';
import { formatConvertCard, formatNotFound, formatError } from '../../utils/format.js';
import { parseConvertArgs } from '../../utils/validation.js';
import type { ConvertResult } from '../../types/index.js';

export async function handleConvert(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length < 3) {
    await ctx.reply(
      '<b>Usage:</b>\n/convert &lt;amount&gt; &lt;from&gt; &lt;to&gt;\n\n<b>Examples:</b>\n/convert 1 BTC ETH\n/convert 100 USD BTC\n/convert 0.5 ETH USDT',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const parsed = parseConvertArgs(args);
  if (!parsed) {
    await ctx.reply(formatError('Invalid format. Use: /convert <amount> <from> <to>'), { parse_mode: 'HTML' });
    return;
  }

  await ctx.replyWithChatAction('typing');

  try {
    // Handle USD as a special case
    const isFromUSD = parsed.fromSymbol === 'USD' || parsed.fromSymbol === 'USDT' || parsed.fromSymbol === 'USDC';
    const isToUSD = parsed.toSymbol === 'USD' || parsed.toSymbol === 'USDT' || parsed.toSymbol === 'USDC';

    let fromPrice: number;
    let toPrice: number;

    if (isFromUSD) {
      fromPrice = 1;
    } else {
      const fromData = await getPrice(parsed.fromSymbol);
      if (!fromData) {
        await ctx.reply(formatNotFound(parsed.fromSymbol), { parse_mode: 'HTML' });
        return;
      }
      fromPrice = fromData.price;
    }

    if (isToUSD) {
      toPrice = 1;
    } else {
      const toData = await getPrice(parsed.toSymbol);
      if (!toData) {
        await ctx.reply(formatNotFound(parsed.toSymbol), { parse_mode: 'HTML' });
        return;
      }
      toPrice = toData.price;
    }

    // Calculate conversion
    const rate = fromPrice / toPrice;
    const result = parsed.amount * rate;

    const convertResult: ConvertResult = {
      amount: parsed.amount,
      fromSymbol: parsed.fromSymbol,
      toSymbol: parsed.toSymbol,
      fromPrice,
      toPrice,
      result,
      rate,
    };

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `convert:${parsed.amount}:${parsed.fromSymbol}:${parsed.toSymbol}`)
      .text('↔️ Swap', `convert:${result.toFixed(6)}:${parsed.toSymbol}:${parsed.fromSymbol}`);

    await ctx.reply(formatConvertCard(convertResult), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch conversion data. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}
