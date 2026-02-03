import cron from 'node-cron';
import type { Bot } from 'grammy';
import { config } from '../config/index.js';
import { logger, logSchedulerRun } from '../utils/logger.js';
import { getAllActiveAlerts, markAlertTriggered, cleanExpiredCache } from '../db/index.js';
import { getPrice } from '../providers/price/index.js';
import { formatAlertTriggered } from '../utils/format.js';

interface SchedulerState {
  lastAlertRun?: Date;
  lastWatchlistRun?: Date;
  alertJob?: cron.ScheduledTask;
  watchlistJob?: cron.ScheduledTask;
  cacheCleanupJob?: cron.ScheduledTask;
}

const state: SchedulerState = {};

export function startScheduler(bot: Bot): void {
  // Alert evaluation job
  state.alertJob = cron.schedule(config.alertJobCron, async () => {
    await runAlertJob(bot);
  });

  // Watchlist update job
  state.watchlistJob = cron.schedule(config.watchJobCron, async () => {
    await runWatchlistJob();
  });

  // Cache cleanup job - hourly
  state.cacheCleanupJob = cron.schedule('0 * * * *', async () => {
    await runCacheCleanupJob();
  });

  logger.info({
    alertCron: config.alertJobCron,
    watchlistCron: config.watchJobCron,
  }, 'Scheduler started');
}

export function stopScheduler(): void {
  state.alertJob?.stop();
  state.watchlistJob?.stop();
  state.cacheCleanupJob?.stop();
  logger.info('Scheduler stopped');
}

export function getSchedulerStatus(): {
  lastAlertRun?: Date;
  lastWatchlistRun?: Date;
} {
  return {
    lastAlertRun: state.lastAlertRun,
    lastWatchlistRun: state.lastWatchlistRun,
  };
}

async function runAlertJob(bot: Bot): Promise<void> {
  const startTime = Date.now();
  let processed = 0;
  let triggered = 0;

  try {
    const alerts = getAllActiveAlerts();

    // Group alerts by token to minimize API calls
    const tokenAlerts = new Map<string, typeof alerts>();
    for (const alert of alerts) {
      const key = `${alert.tokenRef}:${alert.chain ?? ''}`;
      const existing = tokenAlerts.get(key) ?? [];
      existing.push(alert);
      tokenAlerts.set(key, existing);
    }

    // Process each token group
    for (const [key, alertGroup] of tokenAlerts) {
      const [tokenRef, chainStr] = key.split(':');
      const chain = chainStr ? (chainStr as typeof alertGroup[0]['chain']) : undefined;

      try {
        const priceData = await getPrice(tokenRef, chain ?? undefined);
        if (!priceData) continue;

        const currentPrice = priceData.price;

        for (const alert of alertGroup) {
          processed++;

          // Check if alert should trigger
          const shouldTrigger =
            (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
            (alert.direction === 'below' && currentPrice <= alert.targetPrice);

          if (!shouldTrigger) continue;

          // Check cooldown
          if (alert.lastTriggeredAt) {
            const cooldownMs = alert.cooldownMinutes * 60 * 1000;
            const timeSinceLastTrigger = Date.now() - alert.lastTriggeredAt.getTime();
            if (timeSinceLastTrigger < cooldownMs) continue;
          }

          // Trigger alert
          try {
            await bot.api.sendMessage(
              alert.tgChatId,
              formatAlertTriggered(alert, currentPrice),
              { parse_mode: 'HTML' }
            );

            markAlertTriggered(alert.id);
            triggered++;

            logger.info({
              alertId: alert.id,
              token: alert.tokenRef,
              price: currentPrice,
              target: alert.targetPrice,
            }, 'Alert triggered');
          } catch (sendError) {
            logger.error({
              alertId: alert.id,
              chatId: alert.tgChatId,
              error: sendError instanceof Error ? sendError.message : 'Unknown',
            }, 'Failed to send alert notification');
          }
        }
      } catch (error) {
        logger.warn({
          token: tokenRef,
          error: error instanceof Error ? error.message : 'Unknown',
        }, 'Failed to get price for alert check');
      }
    }

    state.lastAlertRun = new Date();
    logSchedulerRun('alert', true, processed);

    logger.debug({
      processed,
      triggered,
      durationMs: Date.now() - startTime,
    }, 'Alert job completed');
  } catch (error) {
    logSchedulerRun('alert', false, 0);
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown',
    }, 'Alert job failed');
  }
}

async function runWatchlistJob(): Promise<void> {
  const startTime = Date.now();
  const processed = 0;

  try {
    // In a full implementation, this would:
    // 1. Get all watchlist items
    // 2. Pre-fetch prices to warm the cache
    // 3. Optionally send summary updates to groups

    // For now, we just update the timestamp
    state.lastWatchlistRun = new Date();
    logSchedulerRun('watchlist', true, processed);

    logger.debug({
      processed,
      durationMs: Date.now() - startTime,
    }, 'Watchlist job completed');
  } catch (error) {
    logSchedulerRun('watchlist', false, 0);
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown',
    }, 'Watchlist job failed');
  }
}

async function runCacheCleanupJob(): Promise<void> {
  try {
    const cleaned = cleanExpiredCache();
    logSchedulerRun('cache_cleanup', true, cleaned);
    logger.debug({ cleaned }, 'Cache cleanup completed');
  } catch (error) {
    logSchedulerRun('cache_cleanup', false, 0);
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown',
    }, 'Cache cleanup job failed');
  }
}
