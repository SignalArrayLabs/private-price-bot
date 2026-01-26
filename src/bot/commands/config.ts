import type { Context } from 'grammy';
import {
  getOrCreateGroup,
  setGroupDefault,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
} from '../../db/index.js';
import { formatWatchlistCard, formatError } from '../../utils/format.js';
import { parseSetDefaultArgs, parseWatchArgs } from '../../utils/validation.js';

export async function handleSetDefault(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/setdefault &lt;symbol|address&gt; [chain]\n\n<b>Examples:</b>\n/setdefault BTC\n/setdefault 0x... ethereum',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const parsed = parseSetDefaultArgs(args);
  if (!parsed) {
    await ctx.reply(formatError('Invalid symbol or address format.'), { parse_mode: 'HTML' });
    return;
  }

  // Get or create group
  const group = getOrCreateGroup(chatId, ctx.chat?.title);

  // Set default
  setGroupDefault(group.id, parsed.symbolOrAddress, parsed.chain);

  const chainText = parsed.chain ? ` on ${parsed.chain.toUpperCase()}` : '';
  await ctx.reply(
    `✅ <b>Default set!</b>\n\n🪙 <b>${parsed.symbolOrAddress.toUpperCase()}</b>${chainText}\n\nUse /default to see the price.`,
    { parse_mode: 'HTML' }
  );
}

export async function handleWatch(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  const parsed = parseWatchArgs(args);
  if (!parsed) {
    await ctx.reply(
      '<b>Usage:</b>\n/watch add &lt;symbol|address&gt; [chain]\n/watch remove &lt;symbol|address&gt;\n/watch list',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Get or create group
  const group = getOrCreateGroup(chatId, ctx.chat?.title);

  switch (parsed.action) {
    case 'list': {
      const items = getWatchlist(group.id);
      await ctx.reply(formatWatchlistCard(items), { parse_mode: 'HTML' });
      break;
    }

    case 'add': {
      if (!parsed.symbolOrAddress) {
        await ctx.reply(formatError('Please specify a token.'), { parse_mode: 'HTML' });
        return;
      }

      const added = addToWatchlist(group.id, parsed.symbolOrAddress, parsed.chain);
      if (added) {
        const chainText = parsed.chain ? ` on ${parsed.chain.toUpperCase()}` : '';
        await ctx.reply(
          `✅ <b>Added to watchlist!</b>\n\n👀 <b>${parsed.symbolOrAddress.toUpperCase()}</b>${chainText}`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(formatError('Already on watchlist or failed to add.'), { parse_mode: 'HTML' });
      }
      break;
    }

    case 'remove': {
      if (!parsed.symbolOrAddress) {
        await ctx.reply(formatError('Please specify a token.'), { parse_mode: 'HTML' });
        return;
      }

      const removed = removeFromWatchlist(group.id, parsed.symbolOrAddress, parsed.chain);
      if (removed) {
        await ctx.reply(
          `✅ <b>Removed from watchlist!</b>\n\n🗑️ <b>${parsed.symbolOrAddress.toUpperCase()}</b>`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(formatError('Not found in watchlist.'), { parse_mode: 'HTML' });
      }
      break;
    }
  }
}
