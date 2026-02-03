import { z } from 'zod';
import { loadValidatedEnv } from '../tools/env/load-env.js';

const { envFile, envSource } = loadValidatedEnv();

// Store globally for identity logger
(globalThis as any).__envFile = envFile;
(globalThis as any).__envSource = envSource;

const configSchema = z.object({
  // Telegram
  telegramBotToken: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  // Price Provider
  priceProvider: z.enum(['coingecko', 'dexscreener', 'coincap', 'binance', 'cmc']).default('dexscreener'),
  coingeckoBaseUrl: z.string().url().default('https://api.coingecko.com/api/v3'),
  coingeckoApiKey: z.string().optional(),
  cmcApiKey: z.string().optional(),

  // Blockchain Explorers
  etherscanApiKey: z.string().optional(),
  bscscanApiKey: z.string().optional(),
  polygonscanApiKey: z.string().optional(),

  // Database
  sqlitePath: z.string().default('./data/bot.db'),

  // Logging
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Schedulers
  alertJobCron: z.string().default('*/1 * * * *'),
  watchJobCron: z.string().default('*/5 * * * *'),

  // Rate Limiting
  rateLimitRequestsPerMinute: z.coerce.number().int().positive().default(30),
  rateLimitWindowMs: z.coerce.number().int().positive().default(60000),

  // Cache TTL (seconds)
  cacheTtlPrice: z.coerce.number().int().positive().default(30),
  cacheTtlSecurity: z.coerce.number().int().positive().default(300),

  // AI Helper
  aiHelperEnabled: z.coerce.boolean().default(false),
  aiHelperApiKey: z.string().optional(),

  // Access Control
  adminTelegramId: z.coerce.number().int().optional(),
  subscriptionPrice: z.coerce.number().positive().default(29.99),
  accessControlEnabled: z.coerce.boolean().default(true),

  // Stripe Configuration (for future payment integration)
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  stripePriceId: z.string().optional(),
  botUrl: z.string().url().optional(),
});

function loadConfig() {
  const rawConfig = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    priceProvider: process.env.PRICE_PROVIDER,
    coingeckoBaseUrl: process.env.COINGECKO_BASE_URL,
    coingeckoApiKey: process.env.COINGECKO_API_KEY,
    cmcApiKey: process.env.CMC_API_KEY,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    bscscanApiKey: process.env.BSCSCAN_API_KEY,
    polygonscanApiKey: process.env.POLYGONSCAN_API_KEY,
    sqlitePath: process.env.SQLITE_PATH,
    logLevel: process.env.LOG_LEVEL,
    alertJobCron: process.env.ALERT_JOB_CRON,
    watchJobCron: process.env.WATCH_JOB_CRON,
    rateLimitRequestsPerMinute: process.env.RATE_LIMIT_REQUESTS_PER_MINUTE,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    cacheTtlPrice: process.env.CACHE_TTL_PRICE,
    cacheTtlSecurity: process.env.CACHE_TTL_SECURITY,
    aiHelperEnabled: process.env.AI_HELPER_ENABLED,
    aiHelperApiKey: process.env.AI_HELPER_API_KEY,
    // Access Control
    adminTelegramId: process.env.ADMIN_TELEGRAM_ID,
    subscriptionPrice: process.env.SUBSCRIPTION_PRICE,
    accessControlEnabled: process.env.ACCESS_CONTROL_ENABLED,
    // Stripe
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripePriceId: process.env.STRIPE_PRICE_ID,
    botUrl: process.env.BOT_URL,
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;

// Supported chains
export const SUPPORTED_CHAINS = ['ethereum', 'bsc', 'polygon', 'solana'] as const;
export type SupportedChain = typeof SUPPORTED_CHAINS[number];

// Chain configurations
export const CHAIN_CONFIG: Record<SupportedChain, {
  name: string;
  symbol: string;
  explorer: string;
  explorerApiUrl: string;
  coingeckoId: string;
}> = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    explorer: 'https://etherscan.io',
    explorerApiUrl: 'https://api.etherscan.io/api',
    coingeckoId: 'ethereum',
  },
  bsc: {
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    explorer: 'https://bscscan.com',
    explorerApiUrl: 'https://api.bscscan.com/api',
    coingeckoId: 'binance-smart-chain',
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    explorer: 'https://polygonscan.com',
    explorerApiUrl: 'https://api.polygonscan.com/api',
    coingeckoId: 'polygon-pos',
  },
  solana: {
    name: 'Solana',
    symbol: 'SOL',
    explorer: 'https://solscan.io',
    explorerApiUrl: 'https://public-api.solscan.io',
    coingeckoId: 'solana',
  },
};
