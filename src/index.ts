import { logger } from './utils/logger.js';
import { initDb, closeDb } from './db/index.js';
import { createBot, startBot, stopBot } from './bot/index.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

async function main() {
  logger.info('Starting Private Price Bot...');

  // Initialize database
  logger.info('Initializing database...');
  initDb();

  // Create bot
  logger.info('Creating bot instance...');
  const bot = createBot();

  // Start scheduler
  logger.info('Starting scheduler...');
  startScheduler(bot);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    try {
      stopScheduler();
      await stopBot(bot);
      closeDb();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start bot
  try {
    await startBot(bot);
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to start bot');
    closeDb();
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
