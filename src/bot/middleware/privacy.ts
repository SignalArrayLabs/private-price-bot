import type { Context, NextFunction } from 'grammy';
import { logCommand } from '../../utils/logger.js';

/**
 * Privacy middleware ensures:
 * 1. We only process commands and mentions
 * 2. We NEVER log message content
 * 3. We only log command type and metadata
 */
export async function privacyMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // Extract safe metadata for logging (NEVER the message content)
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  // Determine if this is a command or mention
  const isCommand = ctx.message?.text?.startsWith('/');
  const isMention = checkIsMention(ctx);

  if (!isCommand && !isMention) {
    // Not a command or mention - DO NOT PROCESS
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
