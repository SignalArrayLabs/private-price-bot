import type { Context } from 'grammy';
import { getPrice } from '../../providers/price/index.js';
import { getContractSecurity, getDeployerInfo } from '../../providers/security/index.js';
import { getOrCreateGroup, deleteAlert } from '../../db/index.js';
import { formatPriceCard, formatSecurityCard, formatDeployerCard, formatError } from '../../utils/format.js';
import { config, type SupportedChain } from '../../config/index.js';
import { InlineKeyboard } from 'grammy';

export async function handleCallback(ctx: Context): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData) return;

  const [action, ...params] = callbackData.split(':');

  try {
    switch (action) {
      case 'refresh':
        await handleRefresh(ctx, params);
        break;
      case 'price':
        await handlePriceCallback(ctx, params);
        break;
      case 'alert':
        await handleAlertCallback(ctx, params);
        break;
      case 'alert_remove':
        await handleAlertRemoveCallback(ctx, params);
        break;
      case 'scan':
        await handleScanCallback(ctx, params);
        break;
      case 'deployer':
        await handleDeployerCallback(ctx, params);
        break;
      default:
        await ctx.answerCallbackQuery({ text: 'Unknown action' });
    }
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error processing request' });
  }
}

async function handleRefresh(ctx: Context, params: string[]): Promise<void> {
  const [symbolOrAddress, chainStr] = params;
  const chain = chainStr ? (chainStr as SupportedChain) : undefined;

  await ctx.answerCallbackQuery({ text: 'Refreshing...' });

  try {
    const priceData = await getPrice(symbolOrAddress, chain, true); // Skip cache

    if (!priceData) {
      await ctx.editMessageText(formatError('Failed to fetch price.'), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `refresh:${symbolOrAddress}:${chain ?? ''}`)
      .text('🔔 Set Alert', `alert:${symbolOrAddress}:${chain ?? ''}`);

    if (symbolOrAddress.startsWith('0x')) {
      keyboard.row().text('🔍 Security', `scan:${symbolOrAddress}:${chain ?? 'ethereum'}`);
    }

    await ctx.editMessageText(formatPriceCard(priceData, config.priceProvider), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing price' });
  }
}

async function handlePriceCallback(ctx: Context, params: string[]): Promise<void> {
  const [symbolOrAddress, chainStr] = params;
  const chain = chainStr ? (chainStr as SupportedChain) : undefined;

  await ctx.answerCallbackQuery({ text: 'Fetching price...' });

  try {
    const priceData = await getPrice(symbolOrAddress, chain);

    if (!priceData) {
      await ctx.answerCallbackQuery({ text: 'Price not found' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `refresh:${symbolOrAddress}:${chain ?? ''}`)
      .text('🔔 Set Alert', `alert:${symbolOrAddress}:${chain ?? ''}`);

    await ctx.reply(formatPriceCard(priceData, config.priceProvider), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error fetching price' });
  }
}

async function handleAlertCallback(ctx: Context, params: string[]): Promise<void> {
  const [symbolOrAddress] = params;

  await ctx.answerCallbackQuery({
    text: `To set an alert:\n/alert add ${symbolOrAddress.toUpperCase()} above <price>`,
    show_alert: true,
  });
}

async function handleAlertRemoveCallback(ctx: Context, params: string[]): Promise<void> {
  const [alertIdStr] = params;
  const alertId = parseInt(alertIdStr, 10);

  if (isNaN(alertId)) {
    await ctx.answerCallbackQuery({ text: 'Invalid alert ID' });
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.answerCallbackQuery({ text: 'Error: No chat context' });
    return;
  }

  const group = getOrCreateGroup(chatId);
  const deleted = deleteAlert(alertId, group.id);

  if (deleted) {
    await ctx.answerCallbackQuery({ text: 'Alert removed!' });
    await ctx.editMessageText(`✅ <b>Alert #${alertId} removed!</b>`, { parse_mode: 'HTML' });
  } else {
    await ctx.answerCallbackQuery({ text: 'Alert not found' });
  }
}

async function handleScanCallback(ctx: Context, params: string[]): Promise<void> {
  const [address, chainStr] = params;
  const chain = (chainStr as SupportedChain) || 'ethereum';

  await ctx.answerCallbackQuery({ text: 'Scanning contract...' });

  try {
    const security = await getContractSecurity(address, chain);

    if (!security) {
      await ctx.answerCallbackQuery({ text: 'Contract not found' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('📊 Price', `price:${address}:${chain}`)
      .text('👤 Deployer', `deployer:${security.deployerAddress ?? address}:${chain}`);

    await ctx.reply(formatSecurityCard(security), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error scanning contract' });
  }
}

async function handleDeployerCallback(ctx: Context, params: string[]): Promise<void> {
  const [address, chainStr] = params;
  const chain = (chainStr as SupportedChain) || 'ethereum';

  await ctx.answerCallbackQuery({ text: 'Fetching deployer info...' });

  try {
    const deployer = await getDeployerInfo(address, chain);

    if (!deployer) {
      await ctx.answerCallbackQuery({ text: 'Deployer not found' });
      return;
    }

    await ctx.reply(formatDeployerCard(deployer), { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error fetching deployer info' });
  }
}
