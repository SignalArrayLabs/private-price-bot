import type { Context, NextFunction } from 'grammy';
import { logCommand, logger } from '../../utils/logger.js';

// Counter for dropped group messages (privacy metric)
let droppedGroupMessageCount = 0;

export function getDroppedGroupMessageCount(): number {
  return droppedGroupMessageCount;
}

/**
 * Privacy middleware ensures:
 * 1. We ONLY process messages in private chats
 * 2. We NEVER read, log, or process group messages
 * 3. We NEVER log message content
 * 4. We only log command type and metadata
 */
export async function privacyMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // CRITICAL PRIVACY GUARD: Block ALL non-private chat messages
  const chatType = ctx.chat?.type;
  if (chatType && chatType !== 'private') {
    // Increment counter but DO NOT log message content
    droppedGroupMessageCount++;
    logger.debug({ chatType, dropped: true }, 'Dropped non-private message');
    return; // Do not process, do not call handlers, do not log content
  }

  // Extract safe metadata for logging (NEVER the message content)
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  // Determine if this is a command or mention
  const isCommand = ctx.message?.text?.startsWith('/');
  const isMention = checkIsMention(ctx);
  const isKeyboardButton = checkIsKeyboardButton(ctx);

  if (!isCommand && !isMention && !isKeyboardButton) {
    // Not a command, mention, or keyboard button - DO NOT PROCESS
    // This ensures we don't read general chat messages
    return;
  }

  // Log ONLY metadata, never message content
  if (chatId && userId) {
    const command = extractCommandName(ctx.message?.text ?? '');
    // Only log command name, chat ID, and user ID - NEVER the full message
    logCommand(chatId, userId, command);
  }

  await next();
}

/**
 * Check if the bot was mentioned in the message
 */
function checkIsMention(ctx: Context): boolean {
  const entities = ctx.message?.entities ?? [];
  const text = ctx.message?.text ?? '';
  const botUsername = ctx.me?.username;

  if (!botUsername) return false;

  for (const entity of entities) {
    if (entity.type === 'mention') {
      const mentionText = text.substring(entity.offset, entity.offset + entity.length);
      if (mentionText.toLowerCase() === `@${botUsername.toLowerCase()}`) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if the message is from a keyboard button
 */
function checkIsKeyboardButton(ctx: Context): boolean {
  const text = ctx.message?.text ?? '';

  // List of keyboard button texts
  const keyboardButtons = [
    '💰 Price',
    '🚀 Gainers',
    '📉 Losers',
    '🔍 Scan',
    '🔔 Alerts',
    '🏆 Board',
  ];

  return keyboardButtons.includes(text);
}

/**
 * Extract just the command name without arguments
 */
function extractCommandName(text: string): string {
  if (!text) return 'unknown';

  // Handle /command format
  if (text.startsWith('/')) {
    const match = text.match(/^\/(\w+)/);
    return match ? match[1] : 'unknown';
  }

  // Handle @BotName command format
  const mentionMatch = text.match(/@\w+\s+(\w+)/);
  return mentionMatch ? mentionMatch[1] : 'mention';
}
