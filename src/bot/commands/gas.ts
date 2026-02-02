import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getGasPrice } from '../../providers/gas/etherscan.js';
import { formatGasCard, formatError } from '../../utils/format.js';
import { parseGasArgs } from '../../utils/validation.js';

export async function handleGas(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  const parsed = parseGasArgs(args);

  await ctx.replyWithChatAction('typing');

  try {
    const gasData = await getGasPrice(parsed.chain);

    if (!gasData) {
      await ctx.reply(
        formatError(`Failed to fetch gas prices for ${parsed.chain}. Please try again later.`),
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Build keyboard with refresh and chain switch buttons
    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `gas:${parsed.chain}`);

    // Add chain switch buttons
    const chains = ['ethereum', 'bsc', 'polygon'] as const;
    const otherChains = chains.filter(c => c !== parsed.chain);

    keyboard.row();
    otherChains.forEach(chain => {
      const label = chain === 'ethereum' ? 'ETH' : chain === 'bsc' ? 'BSC' : 'POLY';
      keyboard.text(`⛽ ${label}`, `gas:${chain}`);
    });

    await ctx.reply(formatGasCard(gasData), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch gas prices. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}
