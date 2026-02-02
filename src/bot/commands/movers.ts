import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getTopGainers, getTopLosers } from '../../providers/movers/coingecko.js';
import { getOnChainGainers, getOnChainLosers } from '../../providers/movers/dexscreener.js';
import { formatGainersCard, formatLosersCard, formatError } from '../../utils/format.js';
import { parseMoversArgs } from '../../utils/validation.js';

export async function handleGainers(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  const parsed = parseMoversArgs(args);

  await ctx.replyWithChatAction('typing');

  try {
    // Route to appropriate provider based on category
    let tokens;
    let source;

    if (parsed.category === 'onchain') {
      tokens = await getOnChainGainers(parsed.limit);
      source = 'DexScreener (On-chain)';
    } else {
      tokens = await getTopGainers(parsed.limit);
      source = 'CoinGecko (Majors)';
    }

    if (tokens.length === 0) {
      await ctx.reply(
        formatError('Failed to fetch top gainers. Please try again later.'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Build keyboard with category toggle
    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `gainers:${parsed.limit}:${parsed.category}`)
      .text('📉 Losers', `losers:${parsed.limit}:${parsed.category}`)
      .row();

    // Add category toggle buttons
    if (parsed.category === 'majors') {
      keyboard.text('⛓️ On-chain', `gainers:${parsed.limit}:onchain`);
    } else {
      keyboard.text('🏦 Majors', `gainers:${parsed.limit}:majors`);
    }

    // Add price buttons for top 3
    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.reply(formatGainersCard(tokens, source), {
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
    // Route to appropriate provider based on category
    let tokens;
    let source;

    if (parsed.category === 'onchain') {
      tokens = await getOnChainLosers(parsed.limit);
      source = 'DexScreener (On-chain)';
    } else {
      tokens = await getTopLosers(parsed.limit);
      source = 'CoinGecko (Majors)';
    }

    if (tokens.length === 0) {
      await ctx.reply(
        formatError('Failed to fetch top losers. Please try again later.'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Build keyboard with category toggle
    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `losers:${parsed.limit}:${parsed.category}`)
      .text('🚀 Gainers', `gainers:${parsed.limit}:${parsed.category}`)
      .row();

    // Add category toggle buttons
    if (parsed.category === 'majors') {
      keyboard.text('⛓️ On-chain', `losers:${parsed.limit}:onchain`);
    } else {
      keyboard.text('🏦 Majors', `losers:${parsed.limit}:majors`);
    }

    // Add price buttons for top 3
    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.reply(formatLosersCard(tokens, source), {
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
