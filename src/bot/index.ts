import { Bot } from 'grammy';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Middleware
import { privacyMiddleware } from './middleware/privacy.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { mentionMiddleware, getMentionContext } from './middleware/mention.js';

// Command handlers
import { handleStart, handleHelp, handlePrivacy, handleStatus } from './commands/general.js';
import { handlePrice, handleDefault, handleChart } from './commands/price.js';
import { handleSetDefault, handleWatch } from './commands/config.js';
import { handleAlert } from './commands/alerts.js';
import { handleCall, handleCalls, handleLeaderboard } from './commands/calls.js';
import { handleScan, handleDeployer, handleWebsiteCheck, handleTwitterCheck } from './commands/security.js';

// Callback handler
import { handleCallback } from './handlers/callbacks.js';

export function createBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Apply middleware in order
  bot.use(privacyMiddleware);
  bot.use(rateLimitMiddleware);
  bot.use(mentionMiddleware);

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

  // Handle callback queries (inline keyboard buttons)
  bot.on('callback_query:data', handleCallback);

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
      // Add more mention-triggered commands as needed
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
