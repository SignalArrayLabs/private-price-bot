import { Bot } from 'grammy';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Middleware
import { privacyMiddleware } from './middleware/privacy.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { mentionMiddleware, getMentionContext } from './middleware/mention.js';
import { accessMiddleware } from './middleware/access.js';

// Command handlers
import { handleStart, handleHelp, handlePrivacy, handleStatus } from './commands/general.js';
import { handlePrice, handleDefault, handleChart } from './commands/price.js';
import { handleSetDefault, handleWatch } from './commands/config.js';
import { handleAlert } from './commands/alerts.js';
import { handleCall, handleCalls, handleLeaderboard } from './commands/calls.js';
import { handleScan, handleDeployer, handleWebsiteCheck, handleTwitterCheck } from './commands/security.js';

// New feature command handlers
import { handleConvert } from './commands/convert.js';
import { handleATH } from './commands/ath.js';
import { handleFGI } from './commands/sentiment.js';
import { handleTrending } from './commands/trending.js';
import { handleGas } from './commands/gas.js';
import { handleGainers, handleLosers } from './commands/movers.js';

// Admin command handlers
import { handleApprove, handleRevoke, handleListUsers, handleCheckUser, handlePayments } from './commands/admin.js';

// Callback handler
import { handleCallback } from './handlers/callbacks.js';

export function createBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Apply middleware in order
  bot.use(privacyMiddleware);
  bot.use(rateLimitMiddleware);
  bot.use(mentionMiddleware);
  bot.use(accessMiddleware);

  // General commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('privacy', handlePrivacy);
  bot.command('status', handleStatus);

  // Price commands
  bot.command('p', handlePrice);
  bot.command('price', handlePrice);
  bot.command('default', handleDefault);
  bot.command('chart', handleChart);

  // Config commands
  bot.command('setdefault', handleSetDefault);
  bot.command('watch', handleWatch);

  // Alert commands
  bot.command('alert', handleAlert);

  // Call and leaderboard commands
  bot.command('call', handleCall);
  bot.command('calls', handleCalls);
  bot.command('lb', handleLeaderboard);

  // Security commands
  bot.command('scan', handleScan);
  bot.command('deployer', handleDeployer);
  bot.command('websitecheck', handleWebsiteCheck);
  bot.command('twittercheck', handleTwitterCheck);

  // New feature commands
  bot.command('convert', handleConvert);
  bot.command('ath', handleATH);
  bot.command('fgi', handleFGI);
  bot.command('trending', handleTrending);
  bot.command('gas', handleGas);
  bot.command('gainers', handleGainers);
  bot.command('losers', handleLosers);

  // Admin commands (access controlled by middleware)
  bot.command('approve', handleApprove);
  bot.command('revoke', handleRevoke);
  bot.command('users', handleListUsers);
  bot.command('checkuser', handleCheckUser);
  bot.command('payments', handlePayments);

  // Handle callback queries (inline keyboard buttons)
  bot.on('callback_query:data', handleCallback);

  // Handle keyboard button presses
  bot.hears('💰 Price', async (ctx) => {
    await ctx.reply('Use: /p <symbol>\nExample: /p BTC', { parse_mode: 'HTML' });
  });

  bot.hears('🚀 Gainers', async (ctx) => {
    await handleGainers(ctx);
  });

  bot.hears('📉 Losers', async (ctx) => {
    await handleLosers(ctx);
  });

  bot.hears('🔍 Scan', async (ctx) => {
    await ctx.reply('Use: /scan <address> [chain]\nExample: /scan 0x...', { parse_mode: 'HTML' });
  });

  bot.hears('🔔 Alerts', async (ctx) => {
    await ctx.reply('Use: /alert list to see alerts\n/alert add <symbol> <above|below> <price>', { parse_mode: 'HTML' });
  });

  bot.hears('🏆 Board', async (ctx) => {
    await ctx.reply('Use: /lb to see the leaderboard', { parse_mode: 'HTML' });
  });

  // Handle mention-triggered commands
  bot.on('message:text', async (ctx) => {
    const mentionCtx = getMentionContext(ctx);
    if (!mentionCtx.isMention || !mentionCtx.command) return;

    // Route mention commands to appropriate handlers
    switch (mentionCtx.command) {
      case 'p':
      case 'price':
        await handlePrice(ctx);
        break;
      case 'scan':
        await handleScan(ctx);
        break;
      case 'help':
        await handleHelp(ctx);
        break;
      case 'status':
        await handleStatus(ctx);
        break;
      case 'privacy':
        await handlePrivacy(ctx);
        break;
      case 'gas':
        await handleGas(ctx);
        break;
      case 'trending':
        await handleTrending(ctx);
        break;
      case 'fgi':
        await handleFGI(ctx);
        break;
      case 'gainers':
        await handleGainers(ctx);
        break;
      case 'losers':
        await handleLosers(ctx);
        break;
    }
  });

  // Error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    logger.error({
      updateId: ctx.update.update_id,
      error: err.error instanceof Error ? err.error.message : 'Unknown error',
    }, 'Bot error');
  });

  return bot;
}

export async function startBot(bot: Bot): Promise<void> {
  // Log bot info
  const me = await bot.api.getMe();
  logger.info({
    id: me.id,
    username: me.username,
    firstName: me.first_name,
  }, 'Bot starting');

  // Set bot commands menu (visible in Telegram)
  await bot.api.setMyCommands([
    { command: 'p', description: 'Quick price lookup - /p BTC' },
    { command: 'price', description: 'Full price card - /price ETH' },
    { command: 'chart', description: 'Price chart link' },
    { command: 'alert', description: 'Manage price alerts' },
    { command: 'watch', description: 'Manage watchlist' },
    { command: 'call', description: 'Make a token call' },
    { command: 'calls', description: 'View recent calls' },
    { command: 'lb', description: 'Leaderboard' },
    { command: 'scan', description: 'Security scan - /scan 0x...' },
    { command: 'help', description: 'Show all commands' },
    { command: 'privacy', description: 'Privacy policy' },
    { command: 'status', description: 'Bot status' },
  ]);

  logger.info('Bot commands menu registered');

  // Start polling
  await bot.start({
    onStart: (botInfo) => {
      logger.info({
        username: botInfo.username,
      }, 'Bot started successfully');
    },
  });
}

export async function stopBot(bot: Bot): Promise<void> {
  await bot.stop();
  logger.info('Bot stopped');
}
