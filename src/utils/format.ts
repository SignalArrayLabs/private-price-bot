import type { PriceData, ContractSecurity, DeployerInfo, Alert, Call, LeaderboardEntry, WebsiteSimilarity, TwitterCheck } from '../types/index.js';

// Escape special characters for Telegram MarkdownV2
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
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

  if (call.notes) {
    message += `📝 <b>Notes:</b> ${escapeHtml(call.notes)}\n`;
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
}): string {
  const uptimeHours = Math.floor(status.uptime / 3600);
  const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);

  let message = `<b>📊 Bot Status</b>\n\n`;
  message += `⏱️ <b>Uptime:</b> ${uptimeHours}h ${uptimeMinutes}m\n`;
  message += `💾 <b>Cache Size:</b> ${status.cacheSize} entries\n`;
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
export function formatHelpCard(): string {
  return `<b>📖 Bot Commands</b>

<b>💰 Price Commands:</b>
/p &lt;symbol|address&gt; - Quick price lookup
/price &lt;symbol|address&gt; - Full price card
/chart &lt;symbol&gt; - Price chart link

<b>⚙️ Configuration:</b>
/setdefault &lt;symbol&gt; - Set default token
/default - Show default token price
/watch add &lt;symbol&gt; - Add to watchlist
/watch remove &lt;symbol&gt; - Remove from list
/watch list - Show watchlist

<b>🔔 Alerts:</b>
/alert add &lt;symbol&gt; &lt;above|below&gt; &lt;price&gt;
/alert list - Show active alerts
/alert remove &lt;id&gt; - Remove alert

<b>📢 Calls &amp; Leaderboard:</b>
/call &lt;symbol&gt; [price] [notes]
/calls - Recent calls
/lb - Leaderboard

<b>🔍 Security:</b>
/scan &lt;address&gt; [chain] - Security scan
/deployer &lt;address&gt; [chain] - Deployer info
/websitecheck &lt;url&gt; - Website analysis
/twittercheck &lt;handle&gt; - Twitter check

<b>ℹ️ Other:</b>
/status - Bot status
/privacy - Privacy policy
/help - This message

<i>You can also use @BotName followed by a command.</i>`;
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

// HTML escape helper
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
