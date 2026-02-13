import type { Context } from 'grammy';
import { isAdmin } from '../middleware/access.js';
import { getPrice, getATHData } from '../../providers/price/index.js';
import { getTopGainers, getTopLosers } from '../../providers/movers/coingecko.js';
import { getOnChainGainers, getOnChainLosers } from '../../providers/movers/dexscreener.js';
import { getGasPrice } from '../../providers/gas/etherscan.js';
import { getFearGreedIndex } from '../../providers/sentiment/alternativeme.js';
import { getTrendingTokens } from '../../providers/trending/coingecko.js';
import { getContractSecurity, resolveSymbolToAddress } from '../../providers/security/index.js';

// Well-known contracts for testing
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH on Ethereum
const BONK_ADDRESS = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK on Solana

// Latency thresholds (seconds)
const LATENCY_OK = 1.0;      // Green - fast response
const LATENCY_SLOW = 3.0;    // Yellow - acceptable but slow
// Note: >3s is considered critical (too slow, potential issue)

// Words that indicate an error or placeholder response
const ERROR_WORDS = ['error', 'failed', 'undefined', 'null', 'n/a', 'unknown', 'coming soon', 'not implemented'];

interface TestResult {
  module: string;
  passed: boolean;
  lines?: number;
  duration: number;
  error?: string;
  latencyStatus: 'ok' | 'slow' | 'critical';
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

function getLatencyStatus(durationSec: number): 'ok' | 'slow' | 'critical' {
  if (durationSec < LATENCY_OK) return 'ok';
  if (durationSec < LATENCY_SLOW) return 'slow';
  return 'critical';
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
    const latencyStatus = getLatencyStatus(duration);

    if (!validation.valid) {
      return {
        module: name,
        passed: false,
        duration,
        error: validation.error,
        latencyStatus,
      };
    }

    return {
      module: name,
      passed: true,
      lines: validation.lines,
      duration,
      latencyStatus,
    };
  } catch (err) {
    const duration = (Date.now() - start) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    return {
      module: name,
      passed: false,
      duration,
      error: message.slice(0, 50),
      latencyStatus: 'critical',
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

  // Define all tests - organized by category
  const tests = [
    // Core price providers
    { name: 'Price (BTC)', fn: () => getPrice('BTC') },
    { name: 'Price (SOL)', fn: () => getPrice('SOL') },
    { name: 'ATH', fn: () => getATHData('BTC') },

    // Movers - CG degraded, OnChain primary
    { name: 'Gainers (CG) [degraded]', fn: () => getTopGainers(3) },
    { name: 'Losers (CG) [degraded]', fn: () => getTopLosers(3) },
    { name: 'Gainers (OnChain) [primary]', fn: () => getOnChainGainers(3) },
    { name: 'Losers (OnChain) [primary]', fn: () => getOnChainLosers(3) },

    // Symbol resolution
    { name: 'Symbol Resolve (EVM)', fn: () => resolveSymbolToAddress('PENGU') },
    { name: 'Symbol Resolve (SOL)', fn: () => resolveSymbolToAddress('BONK') },

    // Gas - multi-chain
    { name: 'Gas (ETH)', fn: () => getGasPrice('ethereum') },
    { name: 'Gas (BSC)', fn: () => getGasPrice('bsc') },

    // Sentiment & trending
    { name: 'Fear & Greed', fn: () => getFearGreedIndex() },
    { name: 'Trending', fn: () => getTrendingTokens() },

    // Security - multi-chain
    { name: 'Security (ETH)', fn: () => getContractSecurity(WETH_ADDRESS, 'ethereum') },
    { name: 'Security (SOL/RugCheck)', fn: () => getContractSecurity(BONK_ADDRESS, 'solana') },

    // Convert function
    { name: 'Convert (BTC→ETH)', fn: async () => {
      const btc = await getPrice('BTC');
      const eth = await getPrice('ETH');
      if (!btc || !eth) return null;
      return { btcPrice: btc.price, ethPrice: eth.price, rate: btc.price / eth.price };
    }},
  ];

  // Run all tests concurrently
  const results = await Promise.all(
    tests.map(test => testModule(test.name, test.fn))
  );

  // Calculate stats
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const slowCount = results.filter(r => r.latencyStatus === 'slow').length;
  const criticalCount = results.filter(r => r.latencyStatus === 'critical').length;
  const avgLatency = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  // Format output with latency indicators
  const lines: string[] = ['<b>Self-Test Results</b>\n'];

  for (const result of results) {
    const latencyIcon = result.latencyStatus === 'ok' ? '⚡' :
                        result.latencyStatus === 'slow' ? '🐢' : '🔴';

    if (result.passed) {
      lines.push(`✅ ${latencyIcon} <b>${result.module}</b>: ${result.lines} lines (${result.duration.toFixed(1)}s)`);
    } else {
      lines.push(`❌ ${latencyIcon} <b>${result.module}</b>: ${result.error} (${result.duration.toFixed(1)}s)`);
    }
  }

  // Summary section
  lines.push('');
  lines.push('<b>Performance Summary</b>');
  lines.push(`⚡ Fast (<1s): ${results.filter(r => r.latencyStatus === 'ok').length}`);
  if (slowCount > 0) lines.push(`🐢 Slow (1-3s): ${slowCount}`);
  if (criticalCount > 0) lines.push(`🔴 Critical (>3s): ${criticalCount}`);
  lines.push(`📊 Avg Latency: ${avgLatency.toFixed(2)}s`);

  lines.push('');
  const statusEmoji = passed === total ? '🎉' : passed >= total * 0.7 ? '⚠️' : '🔴';
  lines.push(`${statusEmoji} <b>RESULT: ${passed}/${total} passed</b>`);

  // Add timestamp for freshness verification
  lines.push(`\n🕐 Tested: ${new Date().toISOString()}`);

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}
