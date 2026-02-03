import type { Context } from 'grammy';
import { Keyboard } from 'grammy';
import { formatHelpCard, formatPrivacyCard, formatStatusCard } from '../../utils/format.js';
import { getProviderStatus } from '../../providers/price/index.js';
import { getSecurityProviderStatus } from '../../providers/security/index.js';
import { getAllActiveAlerts, getAllWatchlistItems } from '../../db/index.js';
import { getSchedulerStatus } from '../../services/scheduler.js';
import { getIdentity } from '../../utils/identity.js';

// Bot start time for uptime calculation
const startTime = Date.now();

export async function handleStart(ctx: Context): Promise<void> {
  const message = `<b>👋 Welcome to Private Price Bot!</b>

A privacy-first crypto price bot that:
• Does NOT require admin permissions
• Does NOT read your group messages
• Only responds to explicit commands

Type /help to see available commands.
Type /privacy to learn about data handling.`;

  // Create persistent keyboard
  const keyboard = new Keyboard()
    .text('💰 Price').text('🚀 Gainers').text('📉 Losers').row()
    .text('🔍 Scan').text('🔔 Alerts').text('🏆 Board')
    .resized()
    .persistent();

  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(formatHelpCard(), { parse_mode: 'HTML' });
}

export async function handlePrivacy(ctx: Context): Promise<void> {
  await ctx.reply(formatPrivacyCard(), { parse_mode: 'HTML' });
}

export async function handleStatus(ctx: Context): Promise<void> {
  const identity = await getIdentity(ctx.api);
  const priceProviderStatus = await getProviderStatus();
  const securityProviderStatus = await getSecurityProviderStatus();
  const alerts = getAllActiveAlerts();
  const watchlist = getAllWatchlistItems();
  const schedulerStatus = getSchedulerStatus();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const providers = [
    ...priceProviderStatus.providers,
    { name: 'Etherscan', healthy: securityProviderStatus.etherscan },
  ];

  const statusCard = formatStatusCard({
    uptime: uptimeSeconds,
    providers,
    lastAlertRun: schedulerStatus.lastAlertRun,
    lastWatchlistRun: schedulerStatus.lastWatchlistRun,
    cacheSize: 0,
    alertCount: alerts.length,
    watchlistCount: watchlist.length,
    gitCommit: identity.gitCommit,
    gitBranch: identity.gitBranch,
    gitDirty: identity.gitDirty,
    botUsername: identity.botUsername,
    envSource: identity.envSource,
  });

  await ctx.reply(statusCard, { parse_mode: 'HTML' });
}
