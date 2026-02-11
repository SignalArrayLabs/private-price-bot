import type { Context } from 'grammy';
import { isAdmin } from '../middleware/access.js';
import { getPrice, getATHData } from '../../providers/price/index.js';
import { getTopGainers, getTopLosers } from '../../providers/movers/coingecko.js';
import { getOnChainGainers, getOnChainLosers } from '../../providers/movers/dexscreener.js';
import { getGasPrice } from '../../providers/gas/etherscan.js';
import { getFearGreedIndex } from '../../providers/sentiment/alternativeme.js';
import { getTrendingTokens } from '../../providers/trending/coingecko.js';
import { getContractSecurity, resolveSymbolToAddress } from '../../providers/security/index.js';

// Well-known contract for testing: WETH on Ethereum
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// Words that indicate an error or placeholder response
const ERROR_WORDS = ['error', 'failed', 'undefined', 'null', 'n/a', 'unknown', 'coming soon', 'not implemented'];

interface TestResult {
  module: string;
  passed: boolean;
  lines?: number;
  duration: number;
  error?: string;
}

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}

function validateResult(result: unknown): { valid: boolean; lines: number; error?: string } {
  if (result === null || result === undefined) {
    return { valid: false, lines: 0, error: 'null result' };
  }

  // Convert to string for inspection
  const str = JSON.stringify(result, null, 2);
  const lines = str.split('\n').length;

  // Check for error words
  const lowerStr = str.toLowerCase();
  for (const word of ERROR_WORDS) {
    if (lowerStr.includes(word)) {
      return { valid: false, lines, error: `contains "${word}"` };
    }
  }

  // Check array results have items
  if (Array.isArray(result) && result.length === 0) {
    return { valid: false, lines, error: 'empty array' };
  }

  return { valid: true, lines };
}

async function testModule(
  name: string,
  testFn: () => Promise<unknown>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await runWithTimeout(testFn(), 25000);
    const duration = (Date.now() - start) / 1000;
    const validation = validateResult(result);

    if (!validation.valid) {
      return {
        module: name,
        passed: false,
        duration,
        error: validation.error,
      };
    }

    return {
      module: name,
      passed: true,
      lines: validation.lines,
      duration,
    };
  } catch (err) {
    const duration = (Date.now() - start) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    return {
      module: name,
      passed: false,
      duration,
      error: message.slice(0, 50),
    };
  }
}

export async function handleSelftest(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('This command is only available to the bot administrator.', { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('<b>Running self-test...</b>\n\nTesting all modules with real API calls. This may take up to 30 seconds.', { parse_mode: 'HTML' });

  // Define all tests - CG movers marked as degraded, OnChain is primary
  const tests = [
    { name: 'Price', fn: () => getPrice('BTC') },
    { name: 'ATH', fn: () => getATHData('BTC') },
    { name: 'Gainers (CG) [degraded]', fn: () => getTopGainers(3) },
    { name: 'Losers (CG) [degraded]', fn: () => getTopLosers(3) },
    { name: 'Gainers (OnChain) [primary]', fn: () => getOnChainGainers(3) },
    { name: 'Losers (OnChain) [primary]', fn: () => getOnChainLosers(3) },
    { name: 'Symbol Resolve', fn: () => resolveSymbolToAddress('PENGU') },
    { name: 'Gas', fn: () => getGasPrice('ethereum') },
    { name: 'Fear & Greed', fn: () => getFearGreedIndex() },
    { name: 'Trending', fn: () => getTrendingTokens() },
    { name: 'Security Scan', fn: () => getContractSecurity(WETH_ADDRESS, 'ethereum') },
  ];

  // Run all tests concurrently
  const results = await Promise.all(
    tests.map(test => testModule(test.name, test.fn))
  );

  // Format output
  const lines: string[] = ['<b>Self-Test Results</b>\n'];

  for (const result of results) {
    if (result.passed) {
      lines.push(`✅ <b>${result.module}</b>: ${result.lines} lines (${result.duration.toFixed(1)}s)`);
    } else {
      lines.push(`❌ <b>${result.module}</b>: ${result.error} (${result.duration.toFixed(1)}s)`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const statusEmoji = passed === total ? '🎉' : passed >= total * 0.7 ? '⚠️' : '🔴';

  lines.push('');
  lines.push(`${statusEmoji} <b>RESULT: ${passed}/${total} passed</b>`);

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}
