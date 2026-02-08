import type { Context, NextFunction } from 'grammy';
import { config } from '../../config/index.js';
import { isUserAuthorized } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import { formatAccessDenied } from '../../utils/format.js';

// Commands that don't require authorization (always accessible)
const PUBLIC_COMMANDS = new Set([
  'start',
  'help',
  'privacy',
]);

// Admin-only commands
const ADMIN_COMMANDS = new Set([
  'approve',
  'revoke',
  'users',
  'checkuser',
  'payments',
  'selftest',
]);

/**
 * Middleware to check if user is authorized to use the bot.
 * - Admins always have access
 * - Public commands are always accessible
 * - Other commands require authorization
 */
export async function accessMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // Skip if access control is disabled
  if (!config.accessControlEnabled) {
    await next();
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }

  // Check if this is a command or callback
  const text = ctx.message?.text ?? '';
  const isCommand = text.startsWith('/');
  const callbackData = ctx.callbackQuery?.data;

  // Extract command name
  let commandName = '';
  if (isCommand) {
    const match = text.match(/^\/(\w+)/);
    commandName = match ? match[1].toLowerCase() : '';
  }

  // Admin always has full access
  if (config.adminTelegramId && userId === config.adminTelegramId) {
    await next();
    return;
  }

  // Admin commands are restricted to admin only
  if (ADMIN_COMMANDS.has(commandName)) {
    logger.warn({ userId, command: commandName }, 'Non-admin attempted admin command');
    await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
    return;
  }

  // Public commands are accessible to everyone
  if (PUBLIC_COMMANDS.has(commandName)) {
    await next();
    return;
  }

  // For all other interactions (commands, callbacks, button presses, mentions), check authorization
  // Using `text` instead of `isCommand` ensures hears handlers and mentions are also protected
  if (text || callbackData) {
    const authorized = isUserAuthorized(userId);

    if (!authorized) {
      logger.info({ userId, interaction: commandName || callbackData || 'button/mention' }, 'Unauthorized user attempted to use bot');
      await ctx.reply(formatAccessDenied(config.subscriptionPrice), { parse_mode: 'HTML' });
      return;
    }
  }

  await next();
}

/**
 * Check if a user ID is the admin
 */
export function isAdmin(userId: number): boolean {
  return config.adminTelegramId !== undefined && userId === config.adminTelegramId;
}

/**
 * Decorator function to require admin access for a handler
 */
export function requireAdmin<T extends Context>(
  handler: (ctx: T) => Promise<void>
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    const userId = ctx.from?.id;
    if (!userId || !isAdmin(userId)) {
      await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
      return;
    }
    await handler(ctx);
  };
}

/**
 * Decorator function to require authorization for a handler
 */
export function requireAuthorized<T extends Context>(
  handler: (ctx: T) => Promise<void>
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    // Skip if access control is disabled
    if (!config.accessControlEnabled) {
      await handler(ctx);
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    // Admin always has access
    if (isAdmin(userId)) {
      await handler(ctx);
      return;
    }

    // Check authorization
    if (!isUserAuthorized(userId)) {
      await ctx.reply(formatAccessDenied(config.subscriptionPrice), { parse_mode: 'HTML' });
      return;
    }

    await handler(ctx);
  };
}
