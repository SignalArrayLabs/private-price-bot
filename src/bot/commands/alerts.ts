import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import {
  getOrCreateGroup,
  createAlert,
  getAlerts,
  deleteAlert,
} from '../../db/index.js';
import { getPrice } from '../../providers/price/index.js';
import { formatAlertCard, formatAlertListCard, formatError } from '../../utils/format.js';
import { parseAlertAddArgs, parseAlertRemoveArgs } from '../../utils/validation.js';

export async function handleAlert(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n' +
      '/alert add &lt;symbol&gt; &lt;above|below&gt; &lt;price&gt; [cooldown_min]\n' +
      '/alert list\n' +
      '/alert remove &lt;id&gt;\n\n' +
      '<b>Examples:</b>\n' +
      '/alert add BTC above 70000\n' +
      '/alert add ETH below 3000 30',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const action = args[0].toLowerCase();

  switch (action) {
    case 'add':
      await handleAlertAdd(ctx, args);
      break;
    case 'list':
      await handleAlertList(ctx);
      break;
    case 'remove':
      await handleAlertRemove(ctx, args);
      break;
    default:
      await ctx.reply(formatError('Unknown action. Use add, list, or remove.'), { parse_mode: 'HTML' });
  }
}

async function handleAlertAdd(ctx: Context, args: string[]): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const parsed = parseAlertAddArgs(args);
  if (!parsed) {
    await ctx.reply(
      formatError('Invalid format.\n\nUsage: /alert add <symbol> <above|below> <price> [cooldown]'),
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Get or create group
  const group = getOrCreateGroup(chatId, ctx.chat?.title);

  // Create alert
  const alert = createAlert(
    group.id,
    parsed.symbol,
    parsed.direction,
    parsed.targetPrice,
    undefined,
    parsed.cooldownMinutes ?? 60
  );

  // Get current price for context
  let currentPrice: number | undefined;
  try {
    const priceData = await getPrice(parsed.symbol);
    currentPrice = priceData?.price;
  } catch {
    // Current price is optional
  }

  const keyboard = new InlineKeyboard()
    .text('🗑️ Remove', `alert_remove:${alert.id}`);

  await ctx.reply(formatAlertCard(alert, currentPrice), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

async function handleAlertList(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Get or create group
  const group = getOrCreateGroup(chatId, ctx.chat?.title);

  // Get alerts
  const alerts = getAlerts(group.id);

  const keyboard = new InlineKeyboard()
    .text('➕ Add Alert', 'alert_add_prompt');

  await ctx.reply(formatAlertListCard(alerts), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

async function handleAlertRemove(ctx: Context, args: string[]): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const parsed = parseAlertRemoveArgs(args);
  if (!parsed) {
    await ctx.reply(
      formatError('Invalid format.\n\nUsage: /alert remove <id>'),
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Get or create group
  const group = getOrCreateGroup(chatId, ctx.chat?.title);

  // Delete alert
  const deleted = deleteAlert(parsed.alertId, group.id);

  if (deleted) {
    await ctx.reply(`✅ <b>Alert #${parsed.alertId} removed!</b>`, { parse_mode: 'HTML' });
  } else {
    await ctx.reply(formatError('Alert not found or already removed.'), { parse_mode: 'HTML' });
  }
}
