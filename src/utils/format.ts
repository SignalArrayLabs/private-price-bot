import type { PriceData, ContractSecurity, DeployerInfo, Alert, Call, LeaderboardEntry, WebsiteSimilarity, TwitterCheck, GasData, TrendingToken, ATHData, FearGreedData, MoverToken, ConvertResult, AuthorizedUser, PaymentTransaction } from '../types/index.js';

// Escape special characters for Telegram MarkdownV2
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// Format number with appropriate precision
export function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (price >= 1) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else if (price >= 0.0001) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  } else {
    // For very small numbers, use scientific notation or show more decimals
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 8,
      maximumFractionDigits: 10,
    });
  }
}

// Format large numbers with K/M/B/T suffixes
export function formatLargeNumber(num: number): string {
  if (num >= 1e12) {
    return `${(num / 1e12).toFixed(2)}T`;
  } else if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Format percentage with sign
export function formatPercentage(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

// Format time ago
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// Truncate address for display
export function truncateAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Generate simple ASCII sparkline from price history
export function generateSparkline(prices: number[]): string {
  if (prices.length < 2) return '';

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  return prices
    .map(p => {
      const normalized = (p - min) / range;
      const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
      return chars[index];
    })
    .join('');
}

// ============ Message Cards ============

// Price card (HTML format for better rendering)
export function formatPriceCard(data: PriceData, provider: string): string {
  const changeEmoji = data.priceChangePercent24h >= 0 ? '📈' : '📉';
  const changeColor = data.priceChangePercent24h >= 0 ? '🟢' : '🔴';

  let message = `<b>📊 ${escapeHtml(data.symbol)}/USD Price</b>\n\n`;
  message += `💰 <b>Price:</b> $${escapeHtml(formatPrice(data.price))}\n`;
  message += `${changeEmoji} <b>24h Change:</b> ${changeColor} ${escapeHtml(formatPercentage(data.priceChangePercent24h))}\n`;

  if (data.marketCap > 0) {
    message += `📊 <b>Market Cap:</b> $${escapeHtml(formatLargeNumber(data.marketCap))}\n`;
  }

  if (data.volume24h > 0) {
    message += `📉 <b>24h Volume:</b> $${escapeHtml(formatLargeNumber(data.volume24h))}\n`;
  }

  if (data.high24h > 0 && data.low24h > 0) {
    message += `⬆️ <b>24h High:</b> $${escapeHtml(formatPrice(data.high24h))}\n`;
    message += `⬇️ <b>24h Low:</b> $${escapeHtml(formatPrice(data.low24h))}\n`;
  }

  message += `\n🕐 <i>Updated: ${escapeHtml(formatTimeAgo(data.lastUpdated))}</i>\n`;
  message += `📡 <i>Source: ${escapeHtml(provider)}</i>`;

  // Add clickable DexScreener link if available
  if (data.dexScreenerUrl) {
    message += `\n🔗 <a href="${data.dexScreenerUrl}">View on DexScreener</a>`;
  }

  return message;
}

// Security scan card
export function formatSecurityCard(data: ContractSecurity): string {
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    unknown: '⚪',
  };

  const riskText = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
    unknown: 'UNKNOWN',
  };

  let message = `<b>🔍 Security Scan</b>\n\n`;
  message += `📍 <b>Address:</b> <code>${escapeHtml(truncateAddress(data.address))}</code>\n`;
  message += `⛓️ <b>Chain:</b> ${escapeHtml(data.chain.toUpperCase())}\n\n`;

  // Checklist
  message += data.isVerified ? '✅ Contract Verified\n' : '❌ Contract NOT Verified\n';
  message += data.isProxy ? '⚠️ Proxy Contract\n' : '✅ Not a Proxy\n';
  message += data.hasMintFunction ? '⚠️ Has Mint Function\n' : '✅ No Mint Function\n';
  message += data.hasOwnerFunction ? '⚠️ Has Owner Privileges\n' : '✅ No Owner Privileges\n';
  message += data.hasPauseFunction ? '⚠️ Can Be Paused\n' : '✅ Cannot Be Paused\n';
  message += data.hasBlacklistFunction ? '⚠️ Has Blacklist\n' : '✅ No Blacklist\n';

  message += `\n<b>Risk Level: ${riskEmoji[data.riskLevel]} ${riskText[data.riskLevel]}</b>\n`;

  if (data.riskFactors.length > 0) {
    message += `\n<b>Risk Factors:</b>\n`;
    data.riskFactors.forEach(factor => {
      message += `• ${escapeHtml(factor)}\n`;
    });
  }

  if (data.deployerAddress) {
    message += `\n👤 <b>Deployer:</b> <code>${escapeHtml(truncateAddress(data.deployerAddress))}</code>`;
  }

  return message;
}

// Deployer info card
export function formatDeployerCard(data: DeployerInfo): string {
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    unknown: '⚪',
  };

  let message = `<b>👤 Deployer Analysis</b>\n\n`;
  message += `📍 <b>Address:</b> <code>${escapeHtml(truncateAddress(data.address))}</code>\n`;
  message += `⛓️ <b>Chain:</b> ${escapeHtml(data.chain.toUpperCase())}\n\n`;

  message += `📦 <b>Contracts Deployed:</b> ${data.contractsDeployed}\n`;

  if (data.firstActivity) {
    message += `📅 <b>First Activity:</b> ${escapeHtml(data.firstActivity.toLocaleDateString())}\n`;
  }

  if (data.lastActivity) {
    message += `📅 <b>Last Activity:</b> ${escapeHtml(data.lastActivity.toLocaleDateString())}\n`;
  }

  message += `\n<b>Risk Level:</b> ${riskEmoji[data.riskLevel]} ${data.riskLevel.toUpperCase()}`;

  return message;
}

// Alert card
export function formatAlertCard(alert: Alert, currentPrice?: number): string {
  const directionEmoji = alert.direction === 'above' ? '📈' : '📉';

  let message = `<b>🔔 Alert #${alert.id}</b>\n\n`;
  message += `${directionEmoji} <b>${escapeHtml(alert.tokenRef.toUpperCase())}</b> ${alert.direction} $${escapeHtml(formatPrice(alert.targetPrice))}\n`;
  message += `⏱️ <b>Cooldown:</b> ${alert.cooldownMinutes} minutes\n`;

  if (currentPrice !== undefined) {
    message += `\n💰 <b>Current Price:</b> $${escapeHtml(formatPrice(currentPrice))}`;
  }

  return message;
}

// Alert list card
export function formatAlertListCard(alerts: Alert[]): string {
  if (alerts.length === 0) {
    return '<b>🔔 No Active Alerts</b>\n\nUse /alert add to create one.';
  }

  let message = `<b>🔔 Active Alerts (${alerts.length})</b>\n\n`;

  alerts.forEach(alert => {
    const directionEmoji = alert.direction === 'above' ? '📈' : '📉';
    message += `#${alert.id} ${directionEmoji} <b>${escapeHtml(alert.tokenRef.toUpperCase())}</b> ${alert.direction} $${escapeHtml(formatPrice(alert.targetPrice))}\n`;
  });

  return message;
}

// Alert triggered notification
export function formatAlertTriggered(alert: Alert, currentPrice: number): string {
  const directionEmoji = alert.direction === 'above' ? '📈' : '📉';
  const verb = alert.direction === 'above' ? 'risen above' : 'fallen below';

  let message = `<b>🚨 ALERT TRIGGERED</b>\n\n`;
  message += `${directionEmoji} <b>${escapeHtml(alert.tokenRef.toUpperCase())}</b> has ${verb} $${escapeHtml(formatPrice(alert.targetPrice))}!\n\n`;
  message += `💰 <b>Current Price:</b> $${escapeHtml(formatPrice(currentPrice))}`;

  return message;
}

// Call card
export function formatCallCard(call: Call, currentPrice?: number): string {
  const username = call.username ? `@${call.username}` : `User ${call.userId}`;

  let message = `<b>📢 New Call</b>\n\n`;
  message += `👤 <b>By:</b> ${escapeHtml(username)}\n`;
  message += `🪙 <b>Token:</b> ${escapeHtml(call.tokenRef.toUpperCase())}\n`;
  message += `💰 <b>Entry:</b> $${escapeHtml(formatPrice(call.callPrice))}\n`;

  if (currentPrice !== undefined && currentPrice > 0) {
    const multiple = currentPrice / call.callPrice;
    const multipleEmoji = multiple >= 1 ? '📈' : '📉';
    message += `${multipleEmoji} <b>Current:</b> $${escapeHtml(formatPrice(currentPrice))} (${multiple.toFixed(2)}x)\n`;
  }

  message += `\n🕐 <i>${escapeHtml(formatTimeAgo(call.callTime))}</i>`;

  return message;
}

// Calls list card
export function formatCallsListCard(calls: Call[]): string {
  if (calls.length === 0) {
    return '<b>📢 No Recent Calls</b>\n\nUse /call to make one.';
  }

  let message = `<b>📢 Recent Calls</b>\n\n`;

  calls.slice(0, 10).forEach(call => {
    const username = call.username ? `@${call.username}` : `User`;
    const multipleText = call.multiple ? ` (${call.multiple.toFixed(2)}x)` : '';
    message += `• <b>${escapeHtml(call.tokenRef.toUpperCase())}</b> at $${escapeHtml(formatPrice(call.callPrice))}${multipleText} - ${escapeHtml(username)}\n`;
  });

  return message;
}

// Leaderboard card
export function formatLeaderboardCard(entries: LeaderboardEntry[]): string {
  if (entries.length === 0) {
    return '<b>🏆 Leaderboard</b>\n\nNo calls recorded yet.';
  }

  let message = `<b>🏆 Leaderboard</b>\n\n`;
  message += `<code> #  User           Calls  Best</code>\n`;
  message += `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n`;

  entries.slice(0, 10).forEach((entry, index) => {
    const rank = (index + 1).toString().padStart(2, ' ');
    const username = (entry.username || `User${entry.userId}`).substring(0, 12).padEnd(12, ' ');
    const calls = entry.totalCalls.toString().padStart(5, ' ');
    const best = `${entry.bestMultiple.toFixed(1)}x`.padStart(5, ' ');

    message += `<code>${rank}. ${username} ${calls}  ${best}</code>\n`;
  });

  message += `\n<i>📊 Based on price performance since call</i>`;

  return message;
}

// Website check card
export function formatWebsiteCard(data: WebsiteSimilarity): string {
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    unknown: '⚪',
  };

  let message = `<b>🌐 Website Analysis</b>\n\n`;
  message += `🔗 <b>URL:</b> ${escapeHtml(data.url)}\n`;
  message += `${data.isReachable ? '✅ Reachable' : '❌ Not Reachable'}\n`;

  if (data.title) {
    message += `📄 <b>Title:</b> ${escapeHtml(data.title)}\n`;
  }

  if (data.contentHash) {
    message += `🔑 <b>Content Hash:</b> <code>${data.contentHash}</code>\n`;
  }

  message += `\n<b>Risk Level:</b> ${riskEmoji[data.riskLevel]} ${data.riskLevel.toUpperCase()}`;

  return message;
}

// Twitter check card
export function formatTwitterCard(data: TwitterCheck): string {
  let message = `<b>🐦 Twitter Check</b>\n\n`;
  message += `👤 <b>Handle:</b> @${escapeHtml(data.handle)}\n`;

  if (data.isLimited) {
    message += `\n⚠️ <b>Limited Mode</b>\n`;
    message += `<i>${escapeHtml(data.limitedReason || 'API access required')}</i>`;
  }

  return message;
}

// Watchlist card
export function formatWatchlistCard(items: Array<{ tokenRef: string; chain: string | null }>): string {
  if (items.length === 0) {
    return '<b>👀 Watchlist Empty</b>\n\nUse /watch add to add tokens.';
  }

  let message = `<b>👀 Watchlist (${items.length})</b>\n\n`;

  items.forEach(item => {
    const chainTag = item.chain ? ` [${item.chain.toUpperCase()}]` : '';
    message += `• <b>${escapeHtml(item.tokenRef.toUpperCase())}</b>${chainTag}\n`;
  });

  return message;
}

// Status card
export function formatStatusCard(status: {
  uptime: number;
  providers: Array<{ name: string; healthy: boolean }>;
  lastAlertRun?: Date;
  lastWatchlistRun?: Date;
  cacheSize: number;
  alertCount: number;
  watchlistCount: number;
  gitCommit?: string;
  gitBranch?: string;
  gitDirty?: boolean;
  botUsername?: string;
  envSource?: string;
}): string {
  const uptimeHours = Math.floor(status.uptime / 3600);
  const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);

  let message = `<b>📊 Bot Status</b>\n\n`;
  message += `⏱️ <b>Uptime:</b> ${uptimeHours}h ${uptimeMinutes}m\n`;

  // Identity section
  if (status.gitCommit || status.botUsername || status.envSource) {
    message += '\n<b>🔧 Identity</b>\n';
    if (status.gitCommit) {
      const dirtyFlag = status.gitDirty ? ' (dirty)' : '';
      message += `📌 <b>Version:</b> ${escapeHtml(status.gitCommit)}${dirtyFlag}`;
      if (status.gitBranch) {
        message += ` (${escapeHtml(status.gitBranch)})`;
      }
      message += '\n';
    }
    if (status.botUsername) {
      message += `🤖 <b>Bot:</b> @${escapeHtml(status.botUsername)}\n`;
    }
    if (status.envSource) {
      message += `🌍 <b>Env:</b> ${escapeHtml(status.envSource)}\n`;
    }
  }

  message += `\n💾 <b>Cache Size:</b> ${status.cacheSize} entries\n`;
  message += `🔔 <b>Active Alerts:</b> ${status.alertCount}\n`;
  message += `👀 <b>Watchlist Items:</b> ${status.watchlistCount}\n\n`;

  message += `<b>Providers:</b>\n`;
  status.providers.forEach(p => {
    const emoji = p.healthy ? '✅' : '❌';
    message += `${emoji} ${escapeHtml(p.name)}\n`;
  });

  if (status.lastAlertRun) {
    message += `\n🔔 <b>Last Alert Check:</b> ${escapeHtml(formatTimeAgo(status.lastAlertRun))}`;
  }

  return message;
}

// Privacy card
export function formatPrivacyCard(): string {
  return `<b>🔒 Privacy Policy</b>

<b>What this bot DOES collect:</b>
• Chat ID (to send responses)
• User ID (for leaderboards only)
• Command arguments (token symbols/addresses)
• Alert and watchlist configurations

<b>What this bot does NOT collect:</b>
• ❌ Message content (except commands)
• ❌ Group chat history
• ❌ User conversations
• ❌ Media or files
• ❌ Private messages

<b>Privacy Guarantees:</b>
• No admin permissions required
• Only processes explicit commands
• No message body logging
• No chat text storage

<i>This bot is designed to be privacy-first.
It only responds to direct commands and mentions.</i>`;
}

// Help card
export function formatHelpCard(isAdmin = false): string {
  let message = `🔒 <i>Privacy-first: this bot never reads your group messages. Commands only.</i>

<b>Bot Commands</b>

<b>Price Commands:</b>
/p &lt;symbol|address&gt; - Quick price lookup
/price &lt;symbol|address&gt; - Full price card
/chart &lt;symbol&gt; - Price chart link
/convert &lt;amt&gt; &lt;from&gt; &lt;to&gt; - Convert currencies
/ath &lt;symbol&gt; - All-time high info

<b>Market Data:</b>
/gas [chain] - Gas prices (ETH/BSC/Polygon)
/trending - Trending tokens
/fgi - Fear &amp; Greed Index
/gainers [n] - Top gainers (24h)
/losers [n] - Top losers (24h)

<b>Configuration:</b>
/setdefault &lt;symbol&gt; - Set default token
/default - Show default token price
/watch add &lt;symbol&gt; - Add to watchlist
/watch remove &lt;symbol&gt; - Remove from list
/watch list - Show watchlist

<b>Alerts:</b>
/alert add &lt;symbol&gt; &lt;above|below&gt; &lt;price&gt;
/alert list - Show active alerts
/alert remove &lt;id&gt; - Remove alert

<b>Calls &amp; Leaderboard:</b>
/call &lt;symbol&gt; [price]
/calls - Recent calls
/lb - Leaderboard

<b>Security:</b>
/scan &lt;address&gt; [chain] - Security scan
/deployer &lt;address&gt; [chain] - Deployer info
/websitecheck &lt;url&gt; - Website analysis
/twittercheck &lt;handle&gt; - Twitter check

<b>Other:</b>
/status - Bot status
/privacy - Privacy policy
/help - This message`;

  if (isAdmin) {
    message += `

<b>Admin Commands:</b>
/approve &lt;user_id&gt; - Grant access to user
/revoke &lt;user_id&gt; - Remove user access
/users - Show all authorized users
/checkuser &lt;user_id&gt; - Check user status
/payments - View payment activity`;
  }

  message += `

<i>You can also use @BotName followed by a command.</i>`;

  return message;
}

// Error messages
export function formatError(message: string): string {
  return `❌ <b>Error</b>\n\n${escapeHtml(message)}`;
}

export function formatNotFound(query: string): string {
  return `❌ <b>Not Found</b>\n\nCould not find data for "${escapeHtml(query)}".`;
}

export function formatRateLimited(waitSeconds: number): string {
  return `⏳ <b>Rate Limited</b>\n\nPlease wait ${waitSeconds} seconds before trying again.`;
}

export function formatPartialScan(address: string, chain: string): string {
  return `⚠️ <b>Partial Scan - Data Unavailable</b>\n\n` +
    `<b>Address:</b> <code>${escapeHtml(address)}</code>\n` +
    `<b>Chain:</b> ${escapeHtml(chain)}\n\n` +
    `Unable to fetch full security data. The contract may be:\n` +
    `• Not verified\n` +
    `• Recently deployed\n` +
    `• Not indexed yet\n\n` +
    `⚠️ <b>Proceed with caution.</b>`;
}

// ============ New Feature Cards ============

// Gas prices card
export function formatGasCard(data: GasData): string {
  const chainName = data.chain.charAt(0).toUpperCase() + data.chain.slice(1);

  let message = `<b>⛽ Gas Prices - ${escapeHtml(chainName)}</b>\n\n`;
  message += `🟢 <b>Low:</b> ${data.low} GWEI\n`;
  message += `🟡 <b>Average:</b> ${data.average} GWEI\n`;
  message += `🔴 <b>Fast:</b> ${data.fast} GWEI\n`;

  if (data.baseFee !== undefined) {
    message += `\n📊 <b>Base Fee:</b> ${data.baseFee.toFixed(2)} GWEI\n`;
  }

  if (data.lastBlock !== undefined) {
    message += `🧱 <b>Block:</b> ${data.lastBlock.toLocaleString()}\n`;
  }

  message += `\n🕐 <i>Updated: ${escapeHtml(formatTimeAgo(data.lastUpdated))}</i>`;

  return message;
}

// Trending tokens card
export function formatTrendingCard(tokens: TrendingToken[]): string {
  if (tokens.length === 0) {
    return '<b>🔥 Trending</b>\n\nNo trending data available.';
  }

  let message = `<b>🔥 Trending on CoinGecko</b>\n\n`;

  tokens.slice(0, 7).forEach((token, index) => {
    const rankText = token.marketCapRank ? `#${token.marketCapRank}` : 'N/A';
    const changeText = token.priceChangePercent24h !== undefined
      ? ` | ${token.priceChangePercent24h >= 0 ? '📈' : '📉'} ${formatPercentage(token.priceChangePercent24h)}`
      : '';

    message += `${index + 1}. <b>${escapeHtml(token.symbol.toUpperCase())}</b> - ${escapeHtml(token.name)}\n`;
    message += `   📊 Rank: ${rankText}${changeText}\n`;
  });

  message += `\n🕐 <i>Updated: just now</i>`;

  return message;
}

// Currency conversion card
export function formatConvertCard(data: ConvertResult): string {
  let message = `<b>💱 Currency Conversion</b>\n\n`;
  message += `💰 <b>${escapeHtml(data.amount.toString())} ${escapeHtml(data.fromSymbol)} = ${escapeHtml(formatPrice(data.result))} ${escapeHtml(data.toSymbol)}</b>\n\n`;
  message += `📊 <b>Rates:</b>\n`;
  message += `• 1 ${escapeHtml(data.fromSymbol)} = $${escapeHtml(formatPrice(data.fromPrice))}\n`;
  message += `• 1 ${escapeHtml(data.toSymbol)} = $${escapeHtml(formatPrice(data.toPrice))}\n`;
  message += `• 1 ${escapeHtml(data.fromSymbol)} = ${escapeHtml(data.rate.toFixed(6))} ${escapeHtml(data.toSymbol)}\n`;
  message += `\n🕐 <i>Updated: just now</i>`;

  return message;
}

// All-time high card
export function formatATHCard(data: ATHData): string {
  const athDate = data.athDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const fromATH = data.athChangePercent;
  const emoji = fromATH >= -10 ? '🔥' : fromATH >= -50 ? '📉' : '💀';

  let message = `<b>🏆 All-Time High - ${escapeHtml(data.name)}</b>\n\n`;
  message += `💰 <b>Current:</b> $${escapeHtml(formatPrice(data.currentPrice))}\n`;
  message += `🥇 <b>ATH:</b> $${escapeHtml(formatPrice(data.ath))}\n`;
  message += `📅 <b>ATH Date:</b> ${escapeHtml(athDate)}\n\n`;
  message += `${emoji} <b>From ATH:</b> ${escapeHtml(formatPercentage(fromATH))}`;

  return message;
}

// Fear & Greed Index card
export function formatFGICard(data: FearGreedData): string {
  const getEmoji = (value: number): string => {
    if (value <= 25) return '😱';
    if (value <= 46) return '😰';
    if (value <= 53) return '😐';
    if (value <= 74) return '🤑';
    return '🚀';
  };

  const getMarker = (value: number, rangeStart: number, rangeEnd: number): string => {
    return value >= rangeStart && value <= rangeEnd ? ' ◄' : '';
  };

  const emoji = getEmoji(data.value);
  const dateStr = data.timestamp.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let message = `<b>🎯 Crypto Fear & Greed Index</b>\n\n`;
  message += `<b>Current: ${data.value} - ${escapeHtml(data.classification)} ${emoji}</b>\n\n`;
  message += `😱 Extreme Fear   [0-25]${getMarker(data.value, 0, 25)}\n`;
  message += `😰 Fear           [26-46]${getMarker(data.value, 26, 46)}\n`;
  message += `😐 Neutral        [47-53]${getMarker(data.value, 47, 53)}\n`;
  message += `🤑 Greed          [54-74]${getMarker(data.value, 54, 74)}\n`;
  message += `🚀 Extreme Greed  [75-100]${getMarker(data.value, 75, 100)}\n`;

  if (data.previousValue !== undefined) {
    const change = data.value - data.previousValue;
    const changeSign = change >= 0 ? '+' : '';
    message += `\n📊 <b>Yesterday:</b> ${data.previousValue} - ${escapeHtml(data.previousClassification || '')}`;
    message += `\n📈 <b>Change:</b> ${changeSign}${change}`;
  }

  message += `\n\n🕐 <i>${escapeHtml(dateStr)}</i>`;
  message += `\n<i>Source: alternative.me</i>`;

  return message;
}

// Top gainers card
export function formatGainersCard(tokens: MoverToken[], source?: string): string {
  if (tokens.length === 0) {
    return '<b>🚀 Top Gainers</b>\n\nNo data available.';
  }

  let message = `<b>🚀 Top Gainers (24h)</b>\n\n`;

  tokens.forEach((token, index) => {
    const tvLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(token.symbol.toUpperCase())}USDT`;
    message += `${index + 1}. <a href="${tvLink}">${escapeHtml(token.symbol.toUpperCase())}</a> ${escapeHtml(formatPercentage(token.priceChangePercent24h))} | $${escapeHtml(formatPrice(token.price))} | MC: $${escapeHtml(formatLargeNumber(token.marketCap))}\n`;
  });

  message += `\n🕐 <i>Updated: just now</i>`;

  if (source) {
    message += `\n📊 <i>Source: ${escapeHtml(source)}</i>`;
  }

  return message;
}

// Top losers card
export function formatLosersCard(tokens: MoverToken[], source?: string): string {
  if (tokens.length === 0) {
    return '<b>📉 Top Losers</b>\n\nNo data available.';
  }

  let message = `<b>📉 Top Losers (24h)</b>\n\n`;

  tokens.forEach((token, index) => {
    const tvLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(token.symbol.toUpperCase())}USDT`;
    message += `${index + 1}. <a href="${tvLink}">${escapeHtml(token.symbol.toUpperCase())}</a> ${escapeHtml(formatPercentage(token.priceChangePercent24h))} | $${escapeHtml(formatPrice(token.price))} | MC: $${escapeHtml(formatLargeNumber(token.marketCap))}\n`;
  });

  message += `\n🕐 <i>Updated: just now</i>`;

  if (source) {
    message += `\n📊 <i>Source: ${escapeHtml(source)}</i>`;
  }

  return message;
}

// ============ Access Control Cards ============

// Access denied message
export function formatAccessDenied(price: number, paymentLink?: string): string {
  let message = `<b>🔒 Private Price Bot</b>\n\n`;
  message += `A privacy-first crypto bot — we never read your group messages, never require admin permissions. Commands only.\n\n`;
  message += `<b>Access Required</b>\n`;
  message += `This bot requires a subscription to use.\n`;

  if (paymentLink) {
    message += `\nClick the link below to get access:\n`;
    message += `<a href="${escapeHtml(paymentLink)}">Get Access Now</a>\n\n`;
  } else {
    message += `Contact the bot administrator to get access.\n\n`;
  }

  message += `<i>Once authorized, you'll have full access to all features.</i>`;

  return message;
}

// Payment success message
export function formatPaymentSuccess(): string {
  return `<b>Payment Successful!</b>\n\n` +
    `You now have full access to all bot features.\n\n` +
    `Use /help to see available commands.`;
}

// Authorized users list card
export function formatAuthorizedUsersList(users: AuthorizedUser[]): string {
  if (users.length === 0) {
    return '<b>Authorized Users</b>\n\nNo authorized users yet.';
  }

  let message = `<b>Authorized Users (${users.length})</b>\n\n`;
  message += `<code> #  User ID      Type        Date</code>\n`;
  message += `<code>${'━'.repeat(42)}</code>\n`;

  users.slice(0, 20).forEach((user, index) => {
    const rank = (index + 1).toString().padStart(2, ' ');
    const userId = user.tgUserId.toString().padEnd(12, ' ');
    const typeEmoji = getAuthTypeEmoji(user.authorizationType);
    const typeShort = getAuthTypeShort(user.authorizationType).padEnd(10, ' ');
    const date = user.authorizedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    message += `<code>${rank}. ${userId} ${typeEmoji}${typeShort} ${date}</code>\n`;
  });

  if (users.length > 20) {
    message += `\n<i>...and ${users.length - 20} more users</i>`;
  }

  return message;
}

// Single user info card
export function formatUserCheckCard(user: AuthorizedUser | null, tgUserId: number): string {
  if (!user) {
    return `<b>User Check</b>\n\n` +
      `<b>User ID:</b> <code>${tgUserId}</code>\n` +
      `<b>Status:</b> Not Authorized\n\n` +
      `<i>Use /approve ${tgUserId} to grant access.</i>`;
  }

  const typeEmoji = getAuthTypeEmoji(user.authorizationType);
  const typeName = getAuthTypeName(user.authorizationType);
  const date = user.authorizedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let message = `<b>User Check</b>\n\n`;
  message += `<b>User ID:</b> <code>${user.tgUserId}</code>\n`;
  if (user.username) {
    message += `<b>Username:</b> @${escapeHtml(user.username)}\n`;
  }
  message += `<b>Status:</b> Authorized\n`;
  message += `<b>Type:</b> ${typeEmoji} ${typeName}\n`;
  message += `<b>Since:</b> ${date}\n`;

  if (user.amountPaid) {
    message += `<b>Paid:</b> $${user.amountPaid.toFixed(2)}\n`;
  }

  if (user.stripePaymentId) {
    message += `<b>Payment ID:</b> <code>${escapeHtml(user.stripePaymentId.substring(0, 20))}...</code>\n`;
  }

  if (user.notes) {
    message += `<b>Notes:</b> ${escapeHtml(user.notes)}\n`;
  }

  return message;
}

// User approved message
export function formatUserApproved(tgUserId: number, username?: string): string {
  const userDisplay = username ? `@${escapeHtml(username)}` : `User ${tgUserId}`;
  return `<b>User Approved</b>\n\n` +
    `${userDisplay} has been granted access to the bot.\n\n` +
    `<i>They can now use all bot commands.</i>`;
}

// User revoked message
export function formatUserRevoked(tgUserId: number): string {
  return `<b>Access Revoked</b>\n\n` +
    `User ${tgUserId} no longer has access to the bot.`;
}

// Payments list card
export function formatPaymentsList(
  payments: PaymentTransaction[],
  stats: { total: number; completed: number; totalRevenue: number; byMethod: Record<string, number> }
): string {
  let message = `<b>Payment Activity</b>\n\n`;

  // Stats summary
  message += `<b>Summary:</b>\n`;
  message += `Total Transactions: ${stats.total}\n`;
  message += `Completed: ${stats.completed}\n`;
  message += `Total Revenue: $${stats.totalRevenue.toFixed(2)}\n\n`;

  if (Object.keys(stats.byMethod).length > 0) {
    message += `<b>By Payment Method:</b>\n`;
    for (const [method, count] of Object.entries(stats.byMethod)) {
      const methodEmoji = method === 'card' ? '' : (method === 'crypto' ? '' : '');
      message += `${methodEmoji} ${escapeHtml(method)}: ${count}\n`;
    }
    message += '\n';
  }

  if (payments.length === 0) {
    message += `<i>No payment transactions yet.</i>`;
    return message;
  }

  message += `<b>Recent Payments:</b>\n`;
  payments.slice(0, 10).forEach(payment => {
    const statusEmoji = payment.status === 'completed' ? '' :
                        payment.status === 'pending' ? '' :
                        payment.status === 'failed' ? '' : '';
    const date = payment.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const userDisplay = payment.username ? `@${escapeHtml(payment.username)}` : `${payment.tgUserId}`;

    message += `${statusEmoji} ${date} - ${userDisplay} - $${payment.amount.toFixed(2)}\n`;
  });

  return message;
}

// Authorization stats card
export function formatAuthorizationStats(stats: {
  total: number;
  byType: Record<string, number>;
}): string {
  let message = `<b>Authorization Stats</b>\n\n`;
  message += `<b>Total Authorized:</b> ${stats.total}\n\n`;

  message += `<b>By Type:</b>\n`;
  message += `Manual: ${stats.byType.manual || 0}\n`;
  message += `Card: ${stats.byType.stripe_card || 0}\n`;
  message += `Crypto: ${stats.byType.stripe_crypto || 0}\n`;

  return message;
}

// Helper functions for auth types
function getAuthTypeEmoji(type: string): string {
  switch (type) {
    case 'stripe_card': return '';
    case 'stripe_crypto': return '';
    case 'manual': return '';
    default: return '';
  }
}

function getAuthTypeShort(type: string): string {
  switch (type) {
    case 'stripe_card': return 'Card';
    case 'stripe_crypto': return 'Crypto';
    case 'manual': return 'Manual';
    default: return 'Unknown';
  }
}

function getAuthTypeName(type: string): string {
  switch (type) {
    case 'stripe_card': return 'Stripe (Card)';
    case 'stripe_crypto': return 'Stripe (Crypto)';
    case 'manual': return 'Manual Approval';
    default: return 'Unknown';
  }
}

// HTML escape helper
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
