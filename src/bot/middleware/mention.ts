import type { Context, NextFunction } from 'grammy';

export interface MentionContext {
  isMention: boolean;
  command?: string;
  args: string[];
}

/**
 * Middleware to parse @BotName mentions and extract command/args
 * This allows users to use "@BotName p BTC" style commands
 */
export async function mentionMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const text = ctx.message?.text;
  const botUsername = ctx.me?.username;

  if (!text || !botUsername) {
    await next();
    return;
  }

  // Check if message starts with @BotName
  const mentionPattern = new RegExp(`^@${botUsername}\\s+(.+)$`, 'i');
  const match = text.match(mentionPattern);

  if (match) {
    const commandText = match[1].trim();
    const parts = commandText.split(/\s+/);

    // Store mention context for handlers
    (ctx as Context & { mentionContext: MentionContext }).mentionContext = {
      isMention: true,
      command: parts[0]?.toLowerCase(),
      args: parts.slice(1),
    };
  } else {
    (ctx as Context & { mentionContext: MentionContext }).mentionContext = {
      isMention: false,
      args: [],
    };
  }

  await next();
}

/**
 * Get mention context from ctx
 */
export function getMentionContext(ctx: Context): MentionContext {
  return (ctx as Context & { mentionContext?: MentionContext }).mentionContext ?? {
    isMention: false,
    args: [],
  };
}

/**
 * Check if the message is a mention-triggered command for a specific command name
 */
export function isMentionCommand(ctx: Context, commandName: string): boolean {
  const mentionCtx = getMentionContext(ctx);
  return mentionCtx.isMention && mentionCtx.command === commandName.toLowerCase();
}

/**
 * Get args from mention context
 */
export function getMentionArgs(ctx: Context): string[] {
  return getMentionContext(ctx).args;
}
