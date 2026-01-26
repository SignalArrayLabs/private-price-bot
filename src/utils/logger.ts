import pino from 'pino';
import { config } from '../config/index.js';

// Create logger with redaction of sensitive fields
export const logger = pino({
  level: config.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
  redact: {
    paths: [
      'apiKey',
      'token',
      'password',
      'secret',
      'authorization',
      'TELEGRAM_BOT_TOKEN',
      '*.apiKey',
      '*.token',
      '*.password',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
});

// Never log message bodies - only log command types and metadata
export function logCommand(
  chatId: number,
  userId: number,
  command: string,
  args?: string[]
) {
  logger.info({
    type: 'command',
    chatId,
    userId,
    command,
    argCount: args?.length ?? 0,
    // Never log actual message content or args values for privacy
  });
}

export function logError(context: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error({
    context,
    error: errorMessage,
    stack: errorStack,
  });
}

export function logProviderCall(
  provider: string,
  endpoint: string,
  success: boolean,
  durationMs: number
) {
  logger.debug({
    type: 'provider_call',
    provider,
    endpoint,
    success,
    durationMs,
  });
}

export function logSchedulerRun(jobName: string, success: boolean, itemsProcessed: number) {
  logger.info({
    type: 'scheduler',
    job: jobName,
    success,
    itemsProcessed,
  });
}
