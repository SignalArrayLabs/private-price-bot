import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import {
  getContractSecurity,
  getDeployerInfo,
  checkWebsite,
  checkTwitter,
  resolveSymbolToAddress,
} from '../../providers/security/index.js';
import {
  formatSecurityCard,
  formatDeployerCard,
  formatWebsiteCard,
  formatTwitterCard,
  formatError,
  formatNotFound,
  formatPartialScan,
} from '../../utils/format.js';
import { parseScanArgs, isAddress, urlSchema, twitterHandleSchema } from '../../utils/validation.js';
import { getMentionArgs, isMentionCommand } from '../middleware/mention.js';
import { logger } from '../../utils/logger.js';

export async function handleScan(ctx: Context): Promise<void> {
  // Get args from command or mention
  let args: string[];
  if (isMentionCommand(ctx, 'scan')) {
    args = getMentionArgs(ctx);
  } else {
    const text = ctx.message?.text ?? '';
    args = text.split(/\s+/).slice(1);
  }

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/scan &lt;symbol or address&gt; [chain]\n\n' +
      '<b>Chains:</b> ethereum, bsc, polygon, solana\n' +
      '<i>Chain is auto-detected from address or symbol</i>\n\n' +
      '<b>Examples:</b>\n' +
      '/scan PENGU (by ticker)\n' +
      '/scan 0x... ethereum (EVM address)\n' +
      '/scan 7xKXtg... (Solana address)',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  // Check if first arg is an address or a symbol
  const firstArg = args[0];
  let address: string;
  let chain: 'ethereum' | 'bsc' | 'polygon' | 'solana';

  if (isAddress(firstArg)) {
    // It's an address - use existing logic
    const parsed = parseScanArgs(args);
    if (!parsed) {
      await ctx.reply(
        formatError('Invalid address format. Must be a valid EVM (0x...) or Solana (base58) address.'),
        { parse_mode: 'HTML' }
      );
      return;
    }
    address = parsed.address;
    chain = parsed.chain;
  } else {
    // It's a symbol - resolve to address
    logger.info({ symbol: firstArg }, '[SCAN] Resolving symbol to address');

    const resolved = await resolveSymbolToAddress(firstArg);
    if (!resolved) {
      await ctx.reply(
        formatError(`Token "${firstArg.toUpperCase()}" not found. Try using the contract address instead.`),
        { parse_mode: 'HTML' }
      );
      return;
    }

    address = resolved.address;
    chain = resolved.chain;

    // Inform user about the resolution
    await ctx.reply(
      `🔍 <b>Resolved:</b> ${resolved.symbol} → <code>${address.slice(0, 8)}...${address.slice(-6)}</code> on ${chain}\n\n<i>Scanning...</i>`,
      { parse_mode: 'HTML' }
    );
  }

  try {
    const security = await getContractSecurity(address, chain);

    if (!security) {
      // Show partial scan instead of hard error
      await ctx.reply(
        formatPartialScan(address, chain),
        { parse_mode: 'HTML' }
      );
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
    await ctx.reply(
      formatError('Failed to scan contract. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}

export async function handleDeployer(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/deployer &lt;address&gt; [chain]\n\n' +
      '<b>Chains:</b> ethereum, bsc, polygon\n\n' +
      '<b>Example:</b>\n/deployer 0x... ethereum',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const address = args[0];
  if (!isAddress(address)) {
    await ctx.reply(
      formatError('Invalid address format. Must be a valid EVM address (0x...).'),
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Determine chain
  let chain: 'ethereum' | 'bsc' | 'polygon' = 'ethereum';
  if (args.length > 1) {
    const chainArg = args[1].toLowerCase();
    if (['ethereum', 'bsc', 'polygon'].includes(chainArg)) {
      chain = chainArg as 'ethereum' | 'bsc' | 'polygon';
    }
  }

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  try {
    const deployer = await getDeployerInfo(address, chain);

    if (!deployer) {
      await ctx.reply(
        formatNotFound(`deployer ${address}`),
        { parse_mode: 'HTML' }
      );
      return;
    }

    await ctx.reply(formatDeployerCard(deployer), { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to fetch deployer info. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}

export async function handleWebsiteCheck(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/websitecheck &lt;url&gt;\n\n' +
      '<b>Example:</b>\n/websitecheck https://example.com',
      { parse_mode: 'HTML' }
    );
    return;
  }

  let url = args[0];

  // Add https if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // Validate URL
  const validUrl = urlSchema.safeParse(url);
  if (!validUrl.success) {
    await ctx.reply(formatError('Invalid URL format.'), { parse_mode: 'HTML' });
    return;
  }

  // Show typing indicator
  await ctx.replyWithChatAction('typing');

  try {
    const result = await checkWebsite(url);
    await ctx.reply(formatWebsiteCard(result), { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to check website. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}

export async function handleTwitterCheck(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b>\n/twittercheck &lt;handle&gt;\n\n' +
      '<b>Example:</b>\n/twittercheck @example',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const handle = args[0];
  const validHandle = twitterHandleSchema.safeParse(handle);

  if (!validHandle.success) {
    await ctx.reply(formatError('Invalid Twitter handle format.'), { parse_mode: 'HTML' });
    return;
  }

  try {
    const result = await checkTwitter(handle);
    await ctx.reply(formatTwitterCard(result), { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(
      formatError('Failed to check Twitter handle. Please try again.'),
      { parse_mode: 'HTML' }
    );
  }
}
