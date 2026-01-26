import type { Context, NextFunction } from 'grammy';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { formatRateLimited } from '../../utils/format.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit tracking
const userLimits = new Map<number, RateLimitEntry>();
const groupLimits = new Map<number, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userLimits) {
    if (entry.resetAt < now) {
      userLimits.delete(key);
    }
  }
  for (const [key, entry] of groupLimits) {
    if (entry.resetAt < now) {
      groupLimits.delete(key);
    }
  }
}, 60000); // Clean up every minute

function checkLimit(
  limitMap: Map<number, RateLimitEntry>,
  id: number,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = limitMap.get(id);

  if (!entry || entry.resetAt < now) {
    // New window
    limitMap.set(id, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxRequests) {
    // Rate limited
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Increment counter
  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function rateLimitMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) {
    await next();
    return;
  }

  const maxRequests = config.rateLimitRequestsPerMinute;
  const windowMs = config.rateLimitWindowMs;

  // Check user limit
  const userCheck = checkLimit(userLimits, userId, maxRequests, windowMs);
  if (!userCheck.allowed) {
    logger.debug({ userId, chatId }, 'User rate limited');
    await ctx.reply(formatRateLimited(userCheck.retryAfterSeconds), { parse_mode: 'HTML' });
    return;
  }

  // Check group limit (double the per-user limit)
  const groupCheck = checkLimit(groupLimits, chatId, maxRequests * 2, windowMs);
  if (!groupCheck.allowed) {
    logger.debug({ userId, chatId }, 'Group rate limited');
    await ctx.reply(formatRateLimited(groupCheck.retryAfterSeconds), { parse_mode: 'HTML' });
    return;
  }

  await next();
}

// Export for testing
export function resetRateLimits(): void {
  userLimits.clear();
  groupLimits.clear();
}
