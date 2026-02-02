import type { Context } from 'grammy';
import { config } from '../../config/index.js';
import {
  authorizeUser,
  revokeUserAuthorization,
  getAllAuthorizedUsers,
  getAuthorizedUser,
  getAuthorizationStats,
  getRecentPayments,
  getPaymentStats,
} from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import {
  formatUserApproved,
  formatUserRevoked,
  formatAuthorizedUsersList,
  formatUserCheckCard,
  formatPaymentsList,
  formatAuthorizationStats,
  formatError,
} from '../../utils/format.js';
import { isAdmin } from '../middleware/access.js';

/**
 * Handle /approve <user_id> command
 * Manually grant access to a user
 */
export async function handleApprove(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b> /approve &lt;user_id&gt; [notes]\n\n' +
      'Example: /approve 123456789 "Friend referral"',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const targetUserId = parseInt(args[0], 10);
  if (isNaN(targetUserId) || targetUserId <= 0) {
    await ctx.reply(formatError('Invalid user ID. Please provide a valid Telegram user ID.'), { parse_mode: 'HTML' });
    return;
  }

  const notes = args.slice(1).join(' ').replace(/^["']|["']$/g, '') || undefined;

  try {
    const user = authorizeUser(targetUserId, 'manual', {
      authorizedBy: userId,
      notes,
    });

    logger.info({ adminId: userId, targetUserId, notes }, 'User manually approved');

    await ctx.reply(formatUserApproved(targetUserId, user.username), { parse_mode: 'HTML' });

    // Try to notify the user if possible
    try {
      await ctx.api.sendMessage(
        targetUserId,
        '<b>Access Granted!</b>\n\n' +
        'You have been granted access to the bot by the administrator.\n\n' +
        'Use /help to see available commands.',
        { parse_mode: 'HTML' }
      );
    } catch {
      // User may not have started the bot yet, ignore
    }
  } catch (error) {
    logger.error({ error, targetUserId }, 'Failed to approve user');
    await ctx.reply(formatError('Failed to approve user. Please try again.'), { parse_mode: 'HTML' });
  }
}

/**
 * Handle /revoke <user_id> command
 * Remove access from a user
 */
export async function handleRevoke(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b> /revoke &lt;user_id&gt;\n\n' +
      'Example: /revoke 123456789',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const targetUserId = parseInt(args[0], 10);
  if (isNaN(targetUserId) || targetUserId <= 0) {
    await ctx.reply(formatError('Invalid user ID. Please provide a valid Telegram user ID.'), { parse_mode: 'HTML' });
    return;
  }

  // Prevent revoking admin access
  if (config.adminTelegramId && targetUserId === config.adminTelegramId) {
    await ctx.reply(formatError('Cannot revoke access from the administrator.'), { parse_mode: 'HTML' });
    return;
  }

  try {
    const revoked = revokeUserAuthorization(targetUserId);

    if (revoked) {
      logger.info({ adminId: userId, targetUserId }, 'User access revoked');
      await ctx.reply(formatUserRevoked(targetUserId), { parse_mode: 'HTML' });

      // Try to notify the user
      try {
        await ctx.api.sendMessage(
          targetUserId,
          '<b>Access Revoked</b>\n\n' +
          'Your access to this bot has been revoked.\n\n' +
          'Contact the administrator if you believe this is an error.',
          { parse_mode: 'HTML' }
        );
      } catch {
        // User may have blocked the bot, ignore
      }
    } else {
      await ctx.reply(formatError('User was not found in the authorized users list.'), { parse_mode: 'HTML' });
    }
  } catch (error) {
    logger.error({ error, targetUserId }, 'Failed to revoke user access');
    await ctx.reply(formatError('Failed to revoke user access. Please try again.'), { parse_mode: 'HTML' });
  }
}

/**
 * Handle /listusers command
 * Show all authorized users
 */
export async function handleListUsers(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
    return;
  }

  try {
    const users = getAllAuthorizedUsers();
    const stats = getAuthorizationStats();

    let message = formatAuthorizedUsersList(users);
    message += '\n\n' + formatAuthorizationStats(stats);

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error({ error }, 'Failed to list users');
    await ctx.reply(formatError('Failed to retrieve user list. Please try again.'), { parse_mode: 'HTML' });
  }
}

/**
 * Handle /checkuser <user_id> command
 * Check if a user has access and how they got it
 */
export async function handleCheckUser(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      '<b>Usage:</b> /checkuser &lt;user_id&gt;\n\n' +
      'Example: /checkuser 123456789',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const targetUserId = parseInt(args[0], 10);
  if (isNaN(targetUserId) || targetUserId <= 0) {
    await ctx.reply(formatError('Invalid user ID. Please provide a valid Telegram user ID.'), { parse_mode: 'HTML' });
    return;
  }

  try {
    const user = getAuthorizedUser(targetUserId);
    await ctx.reply(formatUserCheckCard(user, targetUserId), { parse_mode: 'HTML' });
  } catch (error) {
    logger.error({ error, targetUserId }, 'Failed to check user');
    await ctx.reply(formatError('Failed to check user. Please try again.'), { parse_mode: 'HTML' });
  }
}

/**
 * Handle /payments command
 * Show recent payment activity
 */
export async function handlePayments(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
    return;
  }

  try {
    const payments = getRecentPayments(20);
    const stats = getPaymentStats();

    await ctx.reply(formatPaymentsList(payments, stats), { parse_mode: 'HTML' });
  } catch (error) {
    logger.error({ error }, 'Failed to get payments');
    await ctx.reply(formatError('Failed to retrieve payment data. Please try again.'), { parse_mode: 'HTML' });
  }
}
