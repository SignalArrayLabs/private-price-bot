import type { Context } from 'grammy';
import { getPrice, getATHData } from '../../providers/price/index.js';
import { getContractSecurity, getDeployerInfo } from '../../providers/security/index.js';
import { getOrCreateGroup, deleteAlert } from '../../db/index.js';
import { formatPriceCard, formatSecurityCard, formatDeployerCard, formatError, formatGasCard, formatTrendingCard, formatFGICard, formatGainersCard, formatLosersCard, formatATHCard, formatConvertCard, formatHelpCard } from '../../utils/format.js';
import { config, type SupportedChain } from '../../config/index.js';
import { InlineKeyboard } from 'grammy';
import { getGasPrice } from '../../providers/gas/etherscan.js';
import { getTrendingTokens } from '../../providers/trending/coingecko.js';
import { getFearGreedIndex } from '../../providers/sentiment/alternativeme.js';
import { getTopGainers, getTopLosers } from '../../providers/movers/coingecko.js';
import { getOnChainGainers, getOnChainLosers } from '../../providers/movers/dexscreener.js';
import type { ConvertResult } from '../../types/index.js';

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
      case 'gas':
        await handleGasCallback(ctx, params);
        break;
      case 'trending':
        await handleTrendingCallback(ctx);
        break;
      case 'fgi':
        await handleFGICallback(ctx);
        break;
      case 'gainers':
        await handleGainersCallback(ctx, params);
        break;
      case 'losers':
        await handleLosersCallback(ctx, params);
        break;
      case 'ath':
        await handleATHCallback(ctx, params);
        break;
      case 'convert':
        await handleConvertCallback(ctx, params);
        break;
      case 'help':
        await handleHelpCallback(ctx);
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

async function handleGasCallback(ctx: Context, params: string[]): Promise<void> {
  const [chainStr] = params;
  const chain = (chainStr as SupportedChain) || 'ethereum';

  await ctx.answerCallbackQuery({ text: 'Refreshing gas prices...' });

  try {
    const gasData = await getGasPrice(chain);

    if (!gasData) {
      await ctx.editMessageText(formatError('Failed to fetch gas prices.'), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `gas:${chain}`);

    const chains = ['ethereum', 'bsc', 'polygon'] as const;
    const otherChains = chains.filter(c => c !== chain);
    keyboard.row();
    otherChains.forEach(c => {
      const label = c === 'ethereum' ? 'ETH' : c === 'bsc' ? 'BSC' : 'POLY';
      keyboard.text(`⛽ ${label}`, `gas:${c}`);
    });

    await ctx.editMessageText(formatGasCard(gasData), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing gas prices' });
  }
}

async function handleTrendingCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: 'Refreshing trending...' });

  try {
    const tokens = await getTrendingTokens();

    if (tokens.length === 0) {
      await ctx.editMessageText(formatError('Failed to fetch trending.'), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', 'trending:refresh');

    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.editMessageText(formatTrendingCard(tokens), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing trending' });
  }
}

async function handleFGICallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: 'Refreshing FGI...' });

  try {
    const fgiData = await getFearGreedIndex();

    if (!fgiData) {
      await ctx.editMessageText(formatError('Failed to fetch FGI.'), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', 'fgi:refresh');

    await ctx.editMessageText(formatFGICard(fgiData), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing FGI' });
  }
}

async function handleGainersCallback(ctx: Context, params: string[]): Promise<void> {
  const limit = params[0] ? parseInt(params[0], 10) : 5;
  const category = (params[1] as 'majors' | 'onchain') || 'majors';

  await ctx.answerCallbackQuery({ text: 'Refreshing gainers...' });

  try {
    // Route to appropriate provider
    let tokens;
    let source;

    if (category === 'onchain') {
      tokens = await getOnChainGainers(limit);
      source = 'DexScreener (On-chain)';
    } else {
      tokens = await getTopGainers(limit);
      source = 'CoinGecko (Majors)';
    }

    if (tokens.length === 0) {
      await ctx.editMessageText(formatError('Failed to fetch gainers.'), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `gainers:${limit}:${category}`)
      .text('📉 Losers', `losers:${limit}:${category}`)
      .row();

    // Add category toggle
    if (category === 'majors') {
      keyboard.text('⛓️ On-chain', `gainers:${limit}:onchain`);
    } else {
      keyboard.text('🏦 Majors', `gainers:${limit}:majors`);
    }

    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.editMessageText(formatGainersCard(tokens, source), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing gainers' });
  }
}

async function handleLosersCallback(ctx: Context, params: string[]): Promise<void> {
  const limit = params[0] ? parseInt(params[0], 10) : 5;
  const category = (params[1] as 'majors' | 'onchain') || 'majors';

  await ctx.answerCallbackQuery({ text: 'Refreshing losers...' });

  try {
    // Route to appropriate provider
    let tokens;
    let source;

    if (category === 'onchain') {
      tokens = await getOnChainLosers(limit);
      source = 'DexScreener (On-chain)';
    } else {
      tokens = await getTopLosers(limit);
      source = 'CoinGecko (Majors)';
    }

    if (tokens.length === 0) {
      await ctx.editMessageText(formatError('Failed to fetch losers.'), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `losers:${limit}:${category}`)
      .text('🚀 Gainers', `gainers:${limit}:${category}`)
      .row();

    // Add category toggle
    if (category === 'majors') {
      keyboard.text('⛓️ On-chain', `losers:${limit}:onchain`);
    } else {
      keyboard.text('🏦 Majors', `losers:${limit}:majors`);
    }

    if (tokens.length >= 3) {
      keyboard.row();
      tokens.slice(0, 3).forEach(token => {
        keyboard.text(`📊 ${token.symbol.toUpperCase()}`, `price:${token.symbol}:`);
      });
    }

    await ctx.editMessageText(formatLosersCard(tokens, source), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing losers' });
  }
}

async function handleATHCallback(ctx: Context, params: string[]): Promise<void> {
  const [symbol] = params;

  await ctx.answerCallbackQuery({ text: 'Refreshing ATH...' });

  try {
    const athData = await getATHData(symbol);

    if (!athData) {
      await ctx.editMessageText(formatError('Failed to fetch ATH.'), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `ath:${symbol}`)
      .text('📊 Price', `price:${symbol}:`);

    await ctx.editMessageText(formatATHCard(athData), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing ATH' });
  }
}

async function handleConvertCallback(ctx: Context, params: string[]): Promise<void> {
  const [amountStr, fromSymbol, toSymbol] = params;
  const amount = parseFloat(amountStr);

  if (isNaN(amount)) {
    await ctx.answerCallbackQuery({ text: 'Invalid amount' });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Refreshing conversion...' });

  try {
    const isFromUSD = fromSymbol === 'USD' || fromSymbol === 'USDT' || fromSymbol === 'USDC';
    const isToUSD = toSymbol === 'USD' || toSymbol === 'USDT' || toSymbol === 'USDC';

    let fromPrice: number;
    let toPrice: number;

    if (isFromUSD) {
      fromPrice = 1;
    } else {
      const fromData = await getPrice(fromSymbol);
      if (!fromData) {
        await ctx.editMessageText(formatError(`Price not found for ${fromSymbol}.`), { parse_mode: 'HTML' });
        return;
      }
      fromPrice = fromData.price;
    }

    if (isToUSD) {
      toPrice = 1;
    } else {
      const toData = await getPrice(toSymbol);
      if (!toData) {
        await ctx.editMessageText(formatError(`Price not found for ${toSymbol}.`), { parse_mode: 'HTML' });
        return;
      }
      toPrice = toData.price;
    }

    const rate = fromPrice / toPrice;
    const result = amount * rate;

    const convertResult: ConvertResult = {
      amount,
      fromSymbol,
      toSymbol,
      fromPrice,
      toPrice,
      result,
      rate,
    };

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `convert:${amount}:${fromSymbol}:${toSymbol}`)
      .text('↔️ Swap', `convert:${result.toFixed(6)}:${toSymbol}:${fromSymbol}`);

    await ctx.editMessageText(formatConvertCard(convertResult), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.answerCallbackQuery({ text: 'Error refreshing conversion' });
  }
}

async function handleHelpCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply(formatHelpCard(), { parse_mode: 'HTML' });
}
