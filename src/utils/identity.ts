import { execSync } from 'child_process';
import { logger } from './logger.js';
import { config } from '../config/index.js';

export interface BotIdentity {
  gitCommit: string;
  gitBranch: string;
  gitDirty: boolean;
  botUsername?: string;
  botId?: number;
  webhookUrl?: string;
  envSource: string;
  envFile: string;
  nodeVersion: string;
  startTime: Date;
}

/**
 * Gets git commit hash (short format)
 */
function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Gets current git branch name
 */
function getGitBranch(): string {
  try {
    return execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Checks if git working tree has uncommitted changes
 */
function getGitDirty(): boolean {
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Cached identity to avoid repeated git/API calls
 */
let cachedIdentity: BotIdentity | null = null;

/**
 * Gets bot identity information including git state, bot info, and environment
 *
 * @param bot - Optional grammY bot instance to fetch bot username/ID
 * @returns BotIdentity object with all available information
 */
export async function getIdentity(bot?: any): Promise<BotIdentity> {
  // Return cached identity if available and bot info was already fetched
  if (cachedIdentity && (cachedIdentity.botUsername || !bot)) {
    return cachedIdentity;
  }

  // Get bot info if bot instance provided
  let botUsername: string | undefined;
  let botId: number | undefined;

  if (bot) {
    try {
      const me = await bot.api.getMe();
      botUsername = me.username;
      botId = me.id;
    } catch {
      // Ignore - bot might not be initialized yet
      // Will try again on next call
    }
  }

  // Build identity object
  const identity: BotIdentity = {
    gitCommit: getGitCommit(),
    gitBranch: getGitBranch(),
    gitDirty: getGitDirty(),
    botUsername,
    botId,
    webhookUrl: config.botUrl,
    envSource: (globalThis as any).__envSource || 'unknown',
    envFile: (globalThis as any).__envFile || 'unknown',
    nodeVersion: process.version,
    startTime: cachedIdentity?.startTime || new Date(),
  };

  // Cache if we have bot info or no bot was provided
  if (botUsername || !bot) {
    cachedIdentity = identity;
  }

  return identity;
}

/**
 * Logs bot identity to console with structured format
 */
export function logIdentity(identity: BotIdentity): void {
  const dirtyFlag = identity.gitDirty ? ' (uncommitted changes)' : '';
  const botInfo = identity.botUsername
    ? `@${identity.botUsername} (${identity.botId})`
    : 'not yet initialized';

  logger.info(
    {
      gitCommit: identity.gitCommit,
      gitBranch: identity.gitBranch,
      gitDirty: identity.gitDirty,
      botUsername: identity.botUsername,
      botId: identity.botId,
      webhookUrl: identity.webhookUrl,
      envSource: identity.envSource,
      envFile: identity.envFile,
      nodeVersion: identity.nodeVersion,
    },
    `Bot Identity: ${identity.gitCommit}${dirtyFlag} on ${identity.gitBranch} | Bot: ${botInfo} | Env: ${identity.envSource}`
  );
}

/**
 * Resets cached identity (useful for testing)
 */
export function resetIdentityCache(): void {
  cachedIdentity = null;
}
