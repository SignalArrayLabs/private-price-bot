import { z } from 'zod';
import { SUPPORTED_CHAINS, type SupportedChain } from '../config/index.js';

// Address validation
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address format');

// Solana address validation (base58, 32-44 characters)
export const solanaAddressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address format');

// Symbol validation (1-20 alphanumeric characters)
export const symbolSchema = z.string().min(1).max(20).regex(/^[a-zA-Z0-9]+$/, 'Invalid symbol format');

// Symbol or address
export const symbolOrAddressSchema = z.string().min(1).max(50).refine(
  val => /^[a-zA-Z0-9]+$/.test(val) || /^0x[a-fA-F0-9]{40}$/.test(val),
  'Must be a symbol or valid address'
);

// Chain validation
export const chainSchema = z.enum(SUPPORTED_CHAINS);

// Price validation
export const priceSchema = z.number().positive().finite();

// Alert direction
export const alertDirectionSchema = z.enum(['above', 'below']);

// URL validation
export const urlSchema = z.string().url();

// Twitter handle validation
export const twitterHandleSchema = z.string()
  .min(1)
  .max(15)
  .regex(/^@?[a-zA-Z0-9_]+$/, 'Invalid Twitter handle');

// Command argument parsers

export interface PriceCommandArgs {
  symbolOrAddress: string;
  chain?: SupportedChain;
}

export function parsePriceArgs(args: string[]): PriceCommandArgs | null {
  if (args.length === 0) {
    return null;
  }

  const symbolOrAddress = args[0];
  const validSymbolOrAddress = symbolOrAddressSchema.safeParse(symbolOrAddress);

  if (!validSymbolOrAddress.success) {
    return null;
  }

  let chain: SupportedChain | undefined;
  if (args.length > 1) {
    const chainArg = args[1].toLowerCase();
    const validChain = chainSchema.safeParse(chainArg);
    if (validChain.success) {
      chain = validChain.data;
    }
  }

  return {
    symbolOrAddress: validSymbolOrAddress.data,
    chain,
  };
}

export interface AlertAddArgs {
  symbol: string;
  direction: 'above' | 'below';
  targetPrice: number;
  cooldownMinutes?: number;
}

export function parseAlertAddArgs(args: string[]): AlertAddArgs | null {
  // /alert add <symbol> <above|below> <price> [cooldown]
  if (args.length < 4) {
    return null;
  }

  // args[0] should be 'add'
  if (args[0].toLowerCase() !== 'add') {
    return null;
  }

  const symbol = args[1];
  const validSymbol = symbolOrAddressSchema.safeParse(symbol);
  if (!validSymbol.success) {
    return null;
  }

  const direction = args[2].toLowerCase();
  const validDirection = alertDirectionSchema.safeParse(direction);
  if (!validDirection.success) {
    return null;
  }

  const priceStr = args[3].replace(/[$,]/g, '');
  const price = parseFloat(priceStr);
  if (isNaN(price) || !priceSchema.safeParse(price).success) {
    return null;
  }

  let cooldownMinutes: number | undefined;
  if (args.length > 4) {
    const cooldown = parseInt(args[4], 10);
    if (!isNaN(cooldown) && cooldown > 0 && cooldown <= 1440) {
      cooldownMinutes = cooldown;
    }
  }

  return {
    symbol: validSymbol.data,
    direction: validDirection.data,
    targetPrice: price,
    cooldownMinutes,
  };
}

export interface AlertRemoveArgs {
  alertId: number;
}

export function parseAlertRemoveArgs(args: string[]): AlertRemoveArgs | null {
  // /alert remove <id>
  if (args.length < 2 || args[0].toLowerCase() !== 'remove') {
    return null;
  }

  const alertId = parseInt(args[1], 10);
  if (isNaN(alertId) || alertId <= 0) {
    return null;
  }

  return { alertId };
}

export interface CallArgs {
  symbolOrAddress: string;
  entryPrice?: number;
}

export function parseCallArgs(args: string[]): CallArgs | null {
  if (args.length === 0) {
    return null;
  }

  const symbolOrAddress = args[0];
  const validSymbolOrAddress = symbolOrAddressSchema.safeParse(symbolOrAddress);

  if (!validSymbolOrAddress.success) {
    return null;
  }

  let entryPrice: number | undefined;

  if (args.length > 1) {
    const priceStr = args[1].replace(/[$,]/g, '');
    const price = parseFloat(priceStr);

    if (!isNaN(price) && price > 0) {
      entryPrice = price;
    }
  }

  return {
    symbolOrAddress: validSymbolOrAddress.data,
    entryPrice,
  };
}

export interface WatchArgs {
  action: 'add' | 'remove' | 'list';
  symbolOrAddress?: string;
  chain?: SupportedChain;
}

export function parseWatchArgs(args: string[]): WatchArgs | null {
  if (args.length === 0) {
    return { action: 'list' };
  }

  const action = args[0].toLowerCase();

  if (action === 'list') {
    return { action: 'list' };
  }

  if (action !== 'add' && action !== 'remove') {
    return null;
  }

  if (args.length < 2) {
    return null;
  }

  const symbolOrAddress = args[1];
  const validSymbolOrAddress = symbolOrAddressSchema.safeParse(symbolOrAddress);

  if (!validSymbolOrAddress.success) {
    return null;
  }

  let chain: SupportedChain | undefined;
  if (args.length > 2) {
    const chainArg = args[2].toLowerCase();
    const validChain = chainSchema.safeParse(chainArg);
    if (validChain.success) {
      chain = validChain.data;
    }
  }

  return {
    action,
    symbolOrAddress: validSymbolOrAddress.data,
    chain,
  };
}

export interface SetDefaultArgs {
  symbolOrAddress: string;
  chain?: SupportedChain;
}

export function parseSetDefaultArgs(args: string[]): SetDefaultArgs | null {
  if (args.length === 0) {
    return null;
  }

  const symbolOrAddress = args[0];
  const validSymbolOrAddress = symbolOrAddressSchema.safeParse(symbolOrAddress);

  if (!validSymbolOrAddress.success) {
    return null;
  }

  let chain: SupportedChain | undefined;
  if (args.length > 1) {
    const chainArg = args[1].toLowerCase();
    const validChain = chainSchema.safeParse(chainArg);
    if (validChain.success) {
      chain = validChain.data;
    }
  }

  return {
    symbolOrAddress: validSymbolOrAddress.data,
    chain,
  };
}

export interface ScanArgs {
  address: string;
  chain: SupportedChain;
  chainType: 'evm' | 'solana';
}

export function parseScanArgs(args: string[]): ScanArgs | null {
  if (args.length === 0) {
    return null;
  }

  const address = args[0];

  // Detect chain type from address format
  const chainType = detectChainFromAddress(address);

  if (chainType === 'unknown') {
    return null; // Invalid address format
  }

  // Validate based on detected type
  if (chainType === 'evm') {
    const validAddress = addressSchema.safeParse(address);
    if (!validAddress.success) {
      return null;
    }
  } else if (chainType === 'solana') {
    const validAddress = solanaAddressSchema.safeParse(address);
    if (!validAddress.success) {
      return null;
    }
  }

  // Determine chain
  let chain: SupportedChain;

  if (chainType === 'solana') {
    chain = 'solana';
  } else {
    // EVM - default to ethereum unless specified
    chain = 'ethereum';
    if (args.length > 1) {
      const chainArg = args[1].toLowerCase();
      const validChain = chainSchema.safeParse(chainArg);
      if (validChain.success) {
        chain = validChain.data;
      }
    }
  }

  return {
    address,
    chain,
    chainType,
  };
}

// Check if string looks like an address
export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

// Detect chain type from address format
export function detectChainFromAddress(address: string): 'evm' | 'solana' | 'unknown' {
  // EVM addresses: 0x followed by 40 hex characters
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 'evm';
  }

  // Solana addresses: base58, 32-44 characters, no 0x
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return 'solana';
  }

  return 'unknown';
}

// Normalize chain name
export function normalizeChain(chain: string): SupportedChain | null {
  const normalized = chain.toLowerCase().trim();

  const aliases: Record<string, SupportedChain> = {
    ethereum: 'ethereum',
    eth: 'ethereum',
    mainnet: 'ethereum',
    bsc: 'bsc',
    bnb: 'bsc',
    binance: 'bsc',
    'binance smart chain': 'bsc',
    polygon: 'polygon',
    matic: 'polygon',
    poly: 'polygon',
  };

  return aliases[normalized] ?? null;
}

// ============ New Feature Parsers ============

export interface GasArgs {
  chain: SupportedChain;
}

export function parseGasArgs(args: string[]): GasArgs {
  if (args.length === 0) {
    return { chain: 'ethereum' };
  }

  const chainArg = args[0].toLowerCase();
  const validChain = chainSchema.safeParse(chainArg);

  if (validChain.success) {
    return { chain: validChain.data };
  }

  // Try aliases
  const normalized = normalizeChain(chainArg);
  if (normalized) {
    return { chain: normalized };
  }

  return { chain: 'ethereum' };
}

export interface ConvertArgs {
  amount: number;
  fromSymbol: string;
  toSymbol: string;
}

export function parseConvertArgs(args: string[]): ConvertArgs | null {
  // /convert <amount> <from> <to>
  if (args.length < 3) {
    return null;
  }

  const amountStr = args[0].replace(/[$,]/g, '');
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  const fromSymbol = args[1];
  const toSymbol = args[2];

  const validFrom = symbolOrAddressSchema.safeParse(fromSymbol);
  const validTo = symbolOrAddressSchema.safeParse(toSymbol);

  if (!validFrom.success || !validTo.success) {
    return null;
  }

  return {
    amount,
    fromSymbol: validFrom.data.toUpperCase(),
    toSymbol: validTo.data.toUpperCase(),
  };
}

export interface ATHArgs {
  symbol: string;
}

export function parseATHArgs(args: string[]): ATHArgs | null {
  if (args.length === 0) {
    return null;
  }

  const symbol = args[0];
  const validSymbol = symbolOrAddressSchema.safeParse(symbol);

  if (!validSymbol.success) {
    return null;
  }

  return { symbol: validSymbol.data };
}

export interface MoversArgs {
  limit: number;
  category: 'majors' | 'onchain';
}

export function parseMoversArgs(args: string[]): MoversArgs {
  const defaultLimit = 5;
  const maxLimit = 10;
  let limit = defaultLimit;
  let category: 'majors' | 'onchain' = 'majors'; // Default to majors

  if (args.length === 0) {
    return { limit, category };
  }

  // Parse args - can be in any order
  for (const arg of args) {
    const normalized = arg.toLowerCase();

    // Check for category
    if (normalized === 'onchain' || normalized === 'on-chain' || normalized === 'dex') {
      category = 'onchain';
    } else if (normalized === 'majors' || normalized === 'cex') {
      category = 'majors';
    } else {
      // Try to parse as number
      const num = parseInt(arg, 10);
      if (!isNaN(num) && num > 0) {
        limit = Math.min(num, maxLimit);
      }
    }
  }

  return { limit, category };
}
