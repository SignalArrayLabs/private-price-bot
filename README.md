# Private Price Bot

> **The core purpose of this bot is privacy.** Unlike typical Telegram bots that require admin permissions and read every message in your group, this bot does neither. It only responds to explicit commands - it cannot and does not read your group conversations.

A **privacy-first** Telegram bot for crypto prices, alerts, leaderboards, and token security checks.

## Why This Bot Exists

Most crypto price bots require admin permissions and can read all messages in your group. This creates privacy and security risks. This bot was built to provide the same functionality **without compromising your group's privacy**.

## Executive Summary

This bot replicates major utility of popular group price bots (prices, alerts, leaderboards, scans) while being **privacy-first**:

| Feature | This Bot | Typical Bots |
|---------|----------|--------------|
| Admin Required | ❌ No | ✅ Usually Yes |
| Reads All Messages | ❌ No | ✅ Often Yes |
| Stores Chat Content | ❌ Never | ✅ Sometimes |
| Explicit Trigger Only | ✅ Yes | ❌ Often No |

**Key Privacy Guarantees:**
- Does NOT require admin permissions
- Does NOT read general chat messages (only explicit commands)
- Does NOT store raw message content
- Uses free APIs for testing, upgradable to paid tiers for scale

---

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/SignalArrayLabs/private-price-bot.git
cd private-price-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your TELEGRAM_BOT_TOKEN
```

### 3. Configuration

Edit `.env` file:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional - defaults shown
PRICE_PROVIDER=coingecko
SQLITE_PATH=./data/bot.db
LOG_LEVEL=info
```

### 4. Run the Bot

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

---

## Configuration Safety

This bot includes **environment safety controls** to prevent configuration drift between dev/prod:

### Automatic Validation

All npm scripts validate `.env` syntax before running:

```bash
npm run dev        # Validates .env.development first
npm run start      # Validates .env first
npm run start:prod # Validates .env.production first
```

If your `.env` file has invalid syntax, the bot **fails immediately** with clear error messages.

### Validation Rules

Your `.env` file must follow these rules:

- **Keys**: `UPPERCASE_SNAKE_CASE` (e.g., `TELEGRAM_BOT_TOKEN`)
- **Format**: `KEY=value` (no spaces around `=`)
- **Comments**: Lines starting with `#`
- **Empty lines**: Allowed

**Invalid examples**:
```env
CLAUDE.md              # ❌ No = separator
KEY = value            # ❌ Spaces around =
my_key=value           # ❌ Lowercase key
```

### Identity Logging

The bot logs its identity at startup:

- **Git commit hash** and branch
- **Bot username** and ID
- **Environment source** (development/production)
- **Node version**

View anytime with the `/status` command in Telegram.

### Manual Validation

Validate your `.env` file manually:

```bash
npm run validate:env
```

### Documentation

See `src/tools/env/README.md` for complete validation rules and API reference.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | - | Bot token from @BotFather |
| `PRICE_PROVIDER` | No | `coingecko` | Primary price provider (`coingecko`, `coincap`, `binance`, `cmc`) |
| `COINGECKO_BASE_URL` | No | `https://api.coingecko.com/api/v3` | CoinGecko API URL |
| `COINGECKO_API_KEY` | No | - | CoinGecko Pro API key |
| `CMC_API_KEY` | No | - | CoinMarketCap API key |
| `ETHERSCAN_API_KEY` | No | - | Etherscan API key |
| `BSCSCAN_API_KEY` | No | - | BSCScan API key |
| `POLYGONSCAN_API_KEY` | No | - | PolygonScan API key |
| `SQLITE_PATH` | No | `./data/bot.db` | Database file path |
| `LOG_LEVEL` | No | `info` | Logging level |
| `ALERT_JOB_CRON` | No | `*/1 * * * *` | Alert check schedule |
| `WATCH_JOB_CRON` | No | `*/5 * * * *` | Watchlist update schedule |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | `30` | Per-user rate limit |
| `CACHE_TTL_PRICE` | No | `30` | Price cache TTL (seconds) |
| `CACHE_TTL_SECURITY` | No | `300` | Security cache TTL (seconds) |

---

## Commands

### 💰 Price Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/p <symbol>` | Quick price lookup | `/p BTC` |
| `/price <symbol\|address> [chain]` | Full price card | `/price 0x... ethereum` |
| `/chart <symbol>` | Get chart links | `/chart ETH` |
| `/default` | Show default token price | `/default` |
| `/convert <amt> <from> <to>` | Currency converter | `/convert 1 BTC ETH` |
| `/ath <symbol>` | All-time high info | `/ath BTC` |

### 📊 Market Data

| Command | Description | Example |
|---------|-------------|---------|
| `/gas [chain]` | Gas prices | `/gas ethereum` |
| `/trending` | Trending tokens | `/trending` |
| `/fgi` | Fear & Greed Index | `/fgi` |
| `/gainers [n]` | Top gainers (24h) | `/gainers 5` |
| `/losers [n]` | Top losers (24h) | `/losers 5` |

### ⚙️ Configuration

| Command | Description | Example |
|---------|-------------|---------|
| `/setdefault <symbol> [chain]` | Set group default token | `/setdefault BTC` |
| `/watch add <symbol>` | Add to watchlist | `/watch add ETH` |
| `/watch remove <symbol>` | Remove from watchlist | `/watch remove ETH` |
| `/watch list` | Show watchlist | `/watch list` |

### 🔔 Alerts

| Command | Description | Example |
|---------|-------------|---------|
| `/alert add <symbol> <above\|below> <price>` | Create alert | `/alert add BTC above 70000` |
| `/alert list` | Show active alerts | `/alert list` |
| `/alert remove <id>` | Remove alert | `/alert remove 42` |

### 📢 Calls & Leaderboard

| Command | Description | Example |
|---------|-------------|---------|
| `/call <symbol> [price] [notes]` | Make a call | `/call PEPE 0.00001 bullish` |
| `/calls` | Recent calls in group | `/calls` |
| `/lb` | Leaderboard | `/lb` |

### 🔍 Security

| Command | Description | Example |
|---------|-------------|---------|
| `/scan <address> [chain]` | Security scan | `/scan 0x... ethereum` |
| `/deployer <address> [chain]` | Deployer info | `/deployer 0x...` |
| `/websitecheck <url>` | Website analysis | `/websitecheck https://...` |
| `/twittercheck <handle>` | Twitter check (limited) | `/twittercheck @example` |

### ℹ️ Information

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/privacy` | Show privacy policy |
| `/status` | Show bot status |
| `/whoami` | Show your user info |

### 🔧 Admin Commands (Admin Only)

| Command | Description |
|---------|-------------|
| `/selftest` | Run live API tests on all providers |
| `/approve <user_id>` | Grant user access |
| `/revoke <user_id>` | Remove user access |
| `/users` | List approved users |
| `/checkuser <user_id>` | Check user status |
| `/payments` | View payment info |

### Mention Triggering

You can also use `@BotName` followed by commands:

```
@BotName p BTC
@BotName scan 0x...
```

---

## Adding to a Group

### Permissions Required

**This bot does NOT require admin permissions.** Add it to your group with default permissions:

1. Open your Telegram group
2. Click on group name → Add members
3. Search for your bot by username
4. Add the bot

**DO NOT grant admin privileges.** The bot works with standard member permissions.

### How It Works

The bot only responds to:
- Slash commands (`/p BTC`)
- Direct mentions (`@BotName p BTC`)

It ignores all other messages. Telegram delivers command updates to the bot, which is how it receives commands without reading general chat.

---

## Architecture

For detailed architecture documentation, see [PLANNING.md](./PLANNING.md).

### Key Components

```
private-price-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/               # Configuration
│   ├── db/                   # SQLite database
│   ├── bot/                  # Telegram bot (grammY)
│   │   ├── commands/         # Command handlers
│   │   └── middleware/       # Rate limit, privacy
│   ├── providers/
│   │   ├── price/            # CoinGecko, CoinCap, Binance, DexScreener
│   │   ├── security/         # Etherscan, Solscan, RugCheck
│   │   ├── movers/           # DexScreener (primary), CoinGecko
│   │   ├── trending/         # CoinGecko
│   │   └── sentiment/        # alternative.me (Fear & Greed)
│   ├── services/             # Scheduler, alerts
│   └── utils/                # Formatting, validation
├── tests/                    # Unit & integration tests
├── docs/                     # Additional documentation
├── PLANNING.md               # Architecture details
└── README.md                 # This file
```

### Provider Fallback

Price providers are tried in order with automatic fallback:

```
CoinGecko (primary) → CoinCap → Binance → DexScreener
```

For Solana tokens, DexScreener is used as the primary source.

### Supported Chains

- Ethereum (ETH)
- BNB Smart Chain (BSC)
- Polygon (MATIC)
- Solana (SOL)

---

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Building

```bash
npm run build
```

### Database Migrations

Migrations run automatically on startup. To run manually:

```bash
npm run migrate
```

---

## Manual Test Checklist

Use this checklist when testing in a real Telegram group:

### Setup
- [ ] Create a test Telegram group
- [ ] Add bot **without** admin permissions
- [ ] Verify bot appears as regular member

### Privacy Tests
- [ ] Send a regular message (not command) → Bot should ignore
- [ ] Check bot permissions → Should NOT be admin
- [ ] Run `/privacy` → Shows privacy policy
- [ ] Check logs → No message bodies logged

### Core Commands
- [ ] `/p BTC` → Returns price card
- [ ] `@BotName p BTC` → Returns price card (mention)
- [ ] `/setdefault ETH` → Sets default
- [ ] `/default` → Shows ETH price
- [ ] `/watch add SOL` → Adds to watchlist
- [ ] `/watch list` → Shows SOL
- [ ] `/alert add BTC above 100000` → Creates alert
- [ ] `/alert list` → Shows alert
- [ ] `/call PEPE` → Records call
- [ ] `/lb` → Shows leaderboard
- [ ] `/scan 0x...` → Shows security card
- [ ] `/help` → Shows commands
- [ ] `/status` → Shows bot status

### New Features
- [ ] `/gas` → Returns gas prices for Ethereum
- [ ] `/gas bsc` → Returns gas prices for BSC
- [ ] `/trending` → Shows trending tokens
- [ ] `/fgi` → Shows Fear & Greed Index
- [ ] `/gainers` → Shows top gainers
- [ ] `/losers` → Shows top losers
- [ ] `/convert 1 BTC ETH` → Converts currencies
- [ ] `/ath BTC` → Shows all-time high info

---

## Privacy Statement

### What This Bot Collects

- **Chat ID**: To send responses to the correct group
- **User ID**: For leaderboard tracking (required)
- **Command arguments**: Token symbols and addresses
- **Alert/watchlist config**: User-created configurations

### What This Bot Does NOT Collect

- ❌ General message content
- ❌ Group chat history
- ❌ User conversations
- ❌ Media or files
- ❌ Private messages

### Code Review Notes

Privacy is enforced in code:

1. **Privacy Middleware** (`src/bot/middleware/privacy.ts`): Only processes commands/mentions
2. **Logging** (`src/utils/logger.ts`): Never logs message content, only metadata
3. **Database** (`src/db/schema.ts`): No message body storage, only derived data

---

## API Rate Limits

### External APIs (Free Tier)

| Provider | Limit | Notes |
|----------|-------|-------|
| CoinGecko | 10-30/min | Primary, best coverage |
| CoinCap | 200/min | Fallback |
| Binance | 1200/min | Major pairs only |
| Etherscan | 5/sec | With API key |

### Internal Rate Limiting

- **Per user**: 30 commands/minute
- **Per group**: 60 commands/minute

---

## Troubleshooting

### Bot not responding

1. Check `TELEGRAM_BOT_TOKEN` is correct
2. Ensure bot is added to the group
3. Check logs for errors: `npm run dev`

### Price not found

1. Check symbol spelling
2. For tokens, use contract address with chain: `/p 0x... ethereum`
3. Some obscure tokens may not be available

### Security scan fails

1. Ensure address is valid EVM address (0x...)
2. Specify chain if not Ethereum: `/scan 0x... bsc`
3. Some contracts may not be verified

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Links

- [PLANNING.md](./PLANNING.md) - Architecture, providers, quotas, dev rules (single source of truth)
- [docs/INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md) - Deployment/ops runbook (Hetzner, SSH, PM2)
- [docs/TESTING.md](./docs/TESTING.md) - Test strategy
- [docs/CHANGELOG.md](./docs/CHANGELOG.md) - Version history

---

*Built with privacy in mind. No admin required. No message snooping.*
