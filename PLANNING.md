# Private Price Bot - Architecture & Planning Document

> **Single Source of Truth** for architecture decisions, data flows, provider configurations, API quotas, and development rules.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Development Rules](#development-rules)
3. [Privacy Architecture](#privacy-architecture)
4. [System Architecture](#system-architecture)
5. [Data Models](#data-models)
6. [Provider Layer](#provider-layer)
7. [Command Reference](#command-reference)
8. [API Quotas & Rate Limits](#api-quotas--rate-limits)
9. [Caching Strategy](#caching-strategy)
10. [Scheduler Jobs](#scheduler-jobs)
11. [Security Considerations](#security-considerations)
12. [Error Handling](#error-handling)
13. [Deployment](#deployment)
14. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Purpose

A privacy-first Telegram group bot providing crypto price lookups, alerts, leaderboards, and token security checks without requiring admin permissions or reading group messages.

### Key Differentiators

| Feature | This Bot | Typical Bots |
|---------|----------|--------------|
| Admin Required | ❌ No | ✅ Usually Yes |
| Reads All Messages | ❌ No | ✅ Often Yes |
| Stores Chat Content | ❌ Never | ✅ Sometimes |
| Explicit Trigger Only | ✅ Yes | ❌ Often No |

### Supported Chains (v1)

- Ethereum (ETH)
- BNB Smart Chain (BSC)
- Polygon (MATIC)

---

## Development Rules

> **CRITICAL**: These rules ensure consistency and prevent scope creep.

### 1. Spec-Only Development

- **Only implement what is explicitly requested**
- No "helpful additions" or "nice to have" features
- No assumptions about what the user might want
- If unsure, ASK before building

### 2. Confirmation Before Implementation

Before building any feature:
1. List exactly what will be implemented
2. Wait for user confirmation
3. Build only what was confirmed

### 3. No Over-Engineering

- Keep solutions simple and focused
- Don't add error handling for impossible scenarios
- Don't create abstractions for one-time operations
- Don't design for hypothetical future requirements

### 4. Change Process

| Step | Action |
|------|--------|
| 1 | User requests feature |
| 2 | Developer lists exact changes |
| 3 | User confirms or modifies |
| 4 | Developer implements confirmed scope only |
| 5 | User tests |
| 6 | Commit and push |

### 5. Code Boundaries

**DO:**
- Implement requested commands
- Fix bugs when reported
- Refactor only when asked

**DON'T:**
- Add extra buttons or UI elements
- Add features "while you're at it"
- Expand scope without permission
- Add comments/docs unless requested

### 6. When in Doubt

```
ASK, don't assume.
```

---

## Privacy Architecture

### Data Collection Principles

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIVACY BOUNDARIES                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  COLLECTED (Stored)           │  NOT COLLECTED              │
│  ─────────────────            │  ─────────────              │
│  • Chat ID (group identifier) │  • Message content          │
│  • User ID (for leaderboard)  │  • User conversations       │
│  • Username (optional)        │  • Private messages         │
│  • Command payloads only      │  • Media/files              │
│  • Token symbols/addresses    │  • Reply contexts           │
│  • Alert configurations       │  • Message history          │
│  • Call records (price/time)  │  • User profiles            │
│                               │                              │
└─────────────────────────────────────────────────────────────┘
```

### Message Processing Flow

```
                    Telegram Update
                          │
                          ▼
              ┌───────────────────────┐
              │ Is Command or Mention?│
              └───────────────────────┘
                    │           │
                   Yes          No
                    │           │
                    ▼           ▼
          ┌─────────────┐  ┌─────────┐
          │Parse Command│  │ DISCARD │
          │  Extract    │  │ (Never  │
          │  Arguments  │  │ Process)│
          └─────────────┘  └─────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │ Log: command type,  │
          │ chat_id, user_id    │
          │ (NO message body)   │
          └─────────────────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │ Execute & Respond   │
          └─────────────────────┘
```

### What Gets Logged

```typescript
// CORRECT - Only metadata
logger.info({
  type: 'command',
  chatId: 123456789,
  userId: 987654321,
  command: '/p',
  argCount: 1,
});

// WRONG - Never do this
logger.info({
  message: ctx.message.text,  // ❌ NEVER
  args: ['BTC', 'ETH'],       // ❌ NEVER log actual args
});
```

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TELEGRAM BOT                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Commands   │  │  Mention    │  │  Inline     │                  │
│  │  Handler    │  │  Handler    │  │  Keyboards  │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         └────────────────┴────────────────┘                         │
│                          │                                           │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │     SERVICE LAYER       │
              │  ┌─────────────────────┐│
              │  │ PriceService        ││
              │  │ AlertService        ││
              │  │ LeaderboardService  ││
              │  │ SecurityService     ││
              │  └─────────────────────┘│
              └────────────┬────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  PRICE LAYER    │ │ CACHE LAYER │ │ SECURITY LAYER  │
│ ┌─────────────┐ │ │             │ │ ┌─────────────┐ │
│ │ CoinGecko   │ │ │  In-Memory  │ │ │ Etherscan   │ │
│ │ CoinCap     │ │ │     +       │ │ │ BSCScan     │ │
│ │ Binance     │ │ │   SQLite    │ │ │ PolygonScan │ │
│ └─────────────┘ │ │             │ │ └─────────────┘ │
└─────────────────┘ └─────────────┘ └─────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │      SQLite DB         │
              │  (better-sqlite3)      │
              └────────────────────────┘
```

### Directory Structure

```
private-price-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/
│   │   └── index.ts          # Environment config with Zod validation
│   ├── db/
│   │   ├── index.ts          # Database operations
│   │   ├── schema.ts         # SQLite schema definitions
│   │   └── migrate.ts        # Migration runner
│   ├── bot/
│   │   ├── index.ts          # grammY bot setup
│   │   ├── commands/         # Command handlers
│   │   │   ├── price.ts      # /p, /price, /chart
│   │   │   ├── alerts.ts     # /alert add/list/remove
│   │   │   ├── calls.ts      # /call, /calls, /lb
│   │   │   ├── security.ts   # /scan, /deployer
│   │   │   ├── config.ts     # /setdefault, /watch
│   │   │   └── general.ts    # /help, /privacy, /status
│   │   ├── middleware/
│   │   │   ├── rateLimit.ts  # Per-user/group rate limiting
│   │   │   ├── privacy.ts    # Ensures no message logging
│   │   │   └── mention.ts    # Handles @BotName mentions
│   │   └── handlers/
│   │       └── callbacks.ts  # Inline keyboard callbacks
│   ├── providers/
│   │   ├── price/
│   │   │   ├── index.ts      # Provider orchestration
│   │   │   ├── base.ts       # Base provider class
│   │   │   ├── coingecko.ts  # CoinGecko implementation
│   │   │   ├── coincap.ts    # CoinCap implementation
│   │   │   └── binance.ts    # Binance implementation
│   │   └── security/
│   │       ├── index.ts      # Security provider orchestration
│   │       ├── base.ts       # Base security provider
│   │       ├── etherscan.ts  # Etherscan implementation
│   │       └── website.ts    # Website similarity checker
│   ├── services/
│   │   ├── scheduler.ts      # Cron job management
│   │   ├── alerts.ts         # Alert evaluation logic
│   │   └── leaderboard.ts    # Leaderboard calculations
│   ├── utils/
│   │   ├── logger.ts         # Pino logger with redaction
│   │   ├── format.ts         # Telegram message formatting
│   │   └── validation.ts     # Input validation helpers
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests with mocks
│   └── setup.ts              # Test configuration
├── docs/
│   ├── TESTING.md            # Test strategy
│   └── CHANGELOG.md          # Version history
├── data/                     # SQLite database (gitignored)
├── PLANNING.md               # This file
├── README.md                 # User-facing documentation
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Data Models

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   groups    │       │    users    │       │   alerts    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ tg_chat_id  │───┐   │ tg_user_id  │───┐   │ group_id(FK)│
│ title       │   │   │ username    │   │   │ token_ref   │
│ default_tok │   │   │ first_seen  │   │   │ chain       │
│ default_chn │   │   └─────────────┘   │   │ direction   │
│ created_at  │   │                     │   │ target_price│
└─────────────┘   │                     │   │ cooldown_min│
       │          │                     │   │ last_trigger│
       │          │                     │   │ is_active   │
       ▼          │                     │   │ created_at  │
┌─────────────┐   │                     │   └─────────────┘
│  watchlist  │   │                     │
├─────────────┤   │                     │
│ id (PK)     │   │                     │
│ group_id(FK)│◄──┘                     │
│ token_ref   │                         │
│ chain       │                         │
│ created_at  │                         │
└─────────────┘                         │
                                        │
┌─────────────┐                         │
│    calls    │                         │
├─────────────┤                         │
│ id (PK)     │                         │
│ group_id(FK)│◄────────────────────────┤
│ user_id(FK) │◄────────────────────────┘
│ token_ref   │
│ chain       │
│ call_price  │
│ call_time   │
│ notes       │
└─────────────┘

┌─────────────────┐     ┌─────────────────┐
│  token_cache    │     │ provider_state  │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ key (PK)        │
│ token_ref       │     │ value           │
│ chain           │     │ updated_at      │
│ data_json       │     └─────────────────┘
│ fetched_at      │
│ ttl_seconds     │
└─────────────────┘
```

### Table Definitions

#### groups
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTO | Internal ID |
| tg_chat_id | INTEGER | UNIQUE, NOT NULL | Telegram chat ID |
| title | TEXT | - | Group title (optional) |
| default_token | TEXT | - | Default token for /default |
| default_chain | TEXT | - | Default chain |
| created_at | DATETIME | DEFAULT NOW | Creation timestamp |

#### users
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTO | Internal ID |
| tg_user_id | INTEGER | UNIQUE, NOT NULL | Telegram user ID |
| username | TEXT | - | @username (for display) |
| first_seen_at | DATETIME | DEFAULT NOW | First interaction |

#### alerts
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTO | Alert ID |
| group_id | INTEGER | FK → groups | Owning group |
| token_ref | TEXT | NOT NULL | Symbol or address |
| chain | TEXT | - | Chain (null = auto) |
| direction | TEXT | CHECK above/below | Alert direction |
| target_price | REAL | NOT NULL | Target price USD |
| cooldown_minutes | INTEGER | DEFAULT 60 | Min time between triggers |
| last_triggered_at | DATETIME | - | Last trigger time |
| is_active | INTEGER | DEFAULT 1 | Active flag |
| created_at | DATETIME | DEFAULT NOW | Creation timestamp |

#### calls
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTO | Call ID |
| group_id | INTEGER | FK → groups | Owning group |
| user_id | INTEGER | FK → users | Caller |
| token_ref | TEXT | NOT NULL | Symbol or address |
| chain | TEXT | - | Chain |
| call_price | REAL | NOT NULL | Price at call time |
| call_time | DATETIME | DEFAULT NOW | Call timestamp |
| notes | TEXT | - | Optional notes |

---

## Provider Layer

### Price Providers

#### Provider Interface

```typescript
interface PriceProvider {
  name: string;
  getPrice(symbolOrAddress: string, chain?: SupportedChain): Promise<PriceData | null>;
  searchToken(query: string): Promise<TokenInfo[]>;
  isHealthy(): Promise<boolean>;
}

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: Date;
  chain?: SupportedChain;
  address?: string;
}
```

#### Provider Comparison

| Provider | Symbols | Contracts | Rate Limit (Free) | Notes |
|----------|---------|-----------|-------------------|-------|
| CoinGecko | ✅ Full | ✅ Full | 10-30/min | Best coverage, primary |
| CoinCap | ✅ Major | ❌ No | 200/min | Good fallback, no contracts |
| Binance | ✅ Major | ❌ No | 1200/min | Fast, limited to pairs |

#### Fallback Strategy

```
Request → CoinGecko (primary)
              │
              ├── Success → Return data
              │
              └── Fail/Rate Limited
                      │
                      ▼
              CoinCap (fallback 1)
                      │
                      ├── Success → Return data
                      │
                      └── Fail
                              │
                              ▼
                      Binance (fallback 2)
                              │
                              ├── Success → Return data
                              │
                              └── Fail → Return null
```

### Security Providers

#### Provider Interface

```typescript
interface SecurityProvider {
  name: string;
  getContractSecurity(address: string, chain: SupportedChain): Promise<ContractSecurity | null>;
  getDeployerInfo(address: string, chain: SupportedChain): Promise<DeployerInfo | null>;
}

interface ContractSecurity {
  address: string;
  chain: SupportedChain;
  isVerified: boolean;
  isProxy: boolean;
  hasOwnerFunction: boolean;
  hasMintFunction: boolean;
  hasPauseFunction: boolean;
  hasBlacklistFunction: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  riskFactors: string[];
  deployerAddress?: string;
  createdAt?: Date;
}
```

#### Explorer API Endpoints

| Chain | Explorer | API Base | Key Required |
|-------|----------|----------|--------------|
| Ethereum | Etherscan | api.etherscan.io/api | Optional* |
| BSC | BSCScan | api.bscscan.com/api | Optional* |
| Polygon | PolygonScan | api.polygonscan.com/api | Optional* |

*Free tier available with rate limits

---

## Command Reference

### Input/Output Specifications

#### /p, /price - Price Lookup

**Input:**
```
/p <symbol|address> [chain]
/price <symbol|address> [chain]
@BotName p <symbol|address> [chain]
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol\|address | string | Yes | - | Token symbol (BTC) or contract address |
| chain | string | No | auto | ethereum, bsc, polygon |

**Output (Success):**
```
📊 BTC/USD Price

💰 Price: $67,234.56
📈 24h Change: +$1,234.56 (+1.87%)
📊 Market Cap: $1.32T
📉 24h Volume: $28.5B
⬆️ 24h High: $67,890.12
⬇️ 24h Low: $65,432.10

🕐 Updated: 2 seconds ago
📡 Source: CoinGecko

[🔄 Refresh] [🔔 Set Alert] [🔍 Security]
```

**Output (Error):**
```
❌ Token not found

Could not find price data for "INVALIDTOKEN".
Try searching with the full name or contract address.
```

#### /alert - Alert Management

**Input (Add):**
```
/alert add <symbol> <above|below> <price> [cooldown_minutes]
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | Yes | - | Token symbol or address |
| direction | above\|below | Yes | - | Trigger direction |
| price | number | Yes | - | Target price in USD |
| cooldown_minutes | number | No | 60 | Min time between alerts |

**Output (Add Success):**
```
✅ Alert Created

🔔 Alert #42
📈 BTC above $70,000.00
⏱️ Cooldown: 60 minutes

Current price: $67,234.56
```

**Input (List):**
```
/alert list
```

**Output (List):**
```
🔔 Active Alerts (3)

#42 📈 BTC above $70,000.00
#43 📉 ETH below $3,000.00
#44 📈 SOL above $200.00

[➕ Add Alert] [🗑️ Remove]
```

#### /call - Token Call

**Input:**
```
/call <symbol|address> [entry_price] [notes]
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol\|address | string | Yes | - | Token to call |
| entry_price | number | No | Current | Entry price |
| notes | string | No | - | Optional notes |

**Output:**
```
📢 New Call by @username

🪙 Token: PEPE
💰 Entry: $0.00001234
📝 Notes: Looking bullish

[📊 View Price] [🔍 Scan Token]
```

#### /lb - Leaderboard

**Input:**
```
/lb
```

**Output:**
```
🏆 Leaderboard

 #  User           Calls  Best    Avg
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1  @trader123       15   12.5x   3.2x
 2  @whale_watcher    8    8.3x   2.8x
 3  @degen_master    22    6.1x   1.5x

📊 Based on price performance since call
```

#### /scan - Security Check

**Input:**
```
/scan <symbol|address> [chain]
```

**Output:**
```
🔍 Security Scan: PEPE

✅ Contract Verified
✅ Not a Proxy
⚠️ Has Mint Function
⚠️ Has Owner Privileges
❌ No Liquidity Lock Found

Risk Level: MEDIUM 🟡

Risk Factors:
• Mint function allows token creation
• Owner can modify contract state

Deployer: 0x1234...5678
Created: 2023-04-15

[📊 Price] [👤 Deployer History]
```

---

## API Quotas & Rate Limits

### External API Limits

| Provider | Free Tier | Rate Limit | Reset |
|----------|-----------|------------|-------|
| CoinGecko | 10-30 req/min | Per IP | Rolling |
| CoinCap | 200 req/min | Per IP | Rolling |
| Binance | 1200 req/min | Per IP | Rolling |
| Etherscan | 5 req/sec | Per Key/IP | Rolling |
| BSCScan | 5 req/sec | Per Key/IP | Rolling |
| PolygonScan | 5 req/sec | Per Key/IP | Rolling |

### Internal Rate Limits

| Scope | Limit | Window | Action |
|-------|-------|--------|--------|
| Per User | 30 commands | 60 sec | Soft block + warning |
| Per Group | 60 commands | 60 sec | Soft block + warning |
| Global | 300 commands | 60 sec | Queue overflow |

### Rate Limit Response

```
⏳ Rate Limited

You're sending commands too quickly.
Please wait 30 seconds before trying again.

Limit: 30 commands per minute
```

---

## Caching Strategy

### Cache Tiers

```
┌─────────────────────────────────────────────┐
│              REQUEST                         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         MEMORY CACHE (Map)                   │
│  TTL: 15-30 seconds                          │
│  Size: ~1000 entries                         │
│  Hit Rate Target: 80%+                       │
└─────────────────┬───────────────────────────┘
                  │ Miss
                  ▼
┌─────────────────────────────────────────────┐
│         SQLite CACHE (token_cache)           │
│  TTL: 30-60 seconds                          │
│  Persistent across restarts                  │
└─────────────────┬───────────────────────────┘
                  │ Miss
                  ▼
┌─────────────────────────────────────────────┐
│         EXTERNAL API                         │
│  Rate limited, cached on success             │
└─────────────────────────────────────────────┘
```

### TTL Configuration

| Data Type | Interactive TTL | Background TTL | Notes |
|-----------|-----------------|----------------|-------|
| Price | 15-30 sec | 60 sec | Frequent updates |
| Security | 5 min | 15 min | Rarely changes |
| Token Info | 1 hour | 24 hours | Static data |
| Leaderboard | On demand | N/A | Computed from DB |

---

## Scheduler Jobs

### Job Configuration

| Job | Cron | Default | Description |
|-----|------|---------|-------------|
| Alert Evaluation | `*/1 * * * *` | Every 1 min | Check price alerts |
| Watchlist Update | `*/5 * * * *` | Every 5 min | Refresh watched tokens |
| Cache Cleanup | `0 * * * *` | Hourly | Remove expired cache |

### Alert Evaluation Flow

```
┌─────────────────────────────────────────┐
│         ALERT JOB (every 1 min)          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Fetch all active alerts from DB         │
│  Group by token_ref to minimize API      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  For each unique token:                  │
│  1. Get current price (cached OK)        │
│  2. Compare against alert targets        │
│  3. Check cooldown elapsed               │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  For triggered alerts:                   │
│  1. Send notification to group           │
│  2. Update last_triggered_at             │
└─────────────────────────────────────────┘
```

---

## Security Considerations

### Input Validation

```typescript
// All inputs validated with Zod schemas
const priceCommandSchema = z.object({
  symbolOrAddress: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9]+$|^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(['ethereum', 'bsc', 'polygon']).optional(),
});

const alertCommandSchema = z.object({
  symbol: z.string().min(1).max(50),
  direction: z.enum(['above', 'below']),
  price: z.number().positive().finite(),
  cooldown: z.number().int().min(1).max(1440).optional(),
});
```

### SQL Injection Prevention

- All queries use parameterized statements via better-sqlite3
- No string concatenation in SQL
- Input sanitization before storage

### API Key Protection

- Keys stored in environment variables only
- Never logged (Pino redaction configured)
- Not exposed in error messages

---

## Error Handling

### Error Response Format

```typescript
interface BotError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
}

// Example errors
const ERRORS = {
  TOKEN_NOT_FOUND: {
    code: 'TOKEN_NOT_FOUND',
    message: 'Token lookup failed',
    userMessage: '❌ Token not found. Check the symbol or address.',
    recoverable: true,
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Rate limit exceeded',
    userMessage: '⏳ Too many requests. Please wait a moment.',
    recoverable: true,
  },
  PROVIDER_DOWN: {
    code: 'PROVIDER_DOWN',
    message: 'All providers unavailable',
    userMessage: '🔧 Service temporarily unavailable. Try again shortly.',
    recoverable: true,
  },
};
```

### Provider Failure Handling

```
Provider Failure
       │
       ▼
┌─────────────────┐
│ Mark as Down    │
│ Record timestamp│
│ Double backoff  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Try next        │
│ provider        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐    Health Check (30s)
│ All failed?     │◄───────────────────────┐
├─────────────────┤                        │
│ Yes: Return     │                        │
│ error to user   │                        │
│                 │                        │
│ No: Success     │                        │
└─────────────────┘                        │
                                           │
┌─────────────────┐                        │
│ Down provider   │────────────────────────┘
│ recovery check  │
└─────────────────┘
```

---

## Deployment

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| TELEGRAM_BOT_TOKEN | ✅ | - | Bot token from @BotFather |
| PRICE_PROVIDER | ❌ | coingecko | Primary price provider |
| COINGECKO_BASE_URL | ❌ | api.coingecko.com/api/v3 | CoinGecko API URL |
| COINGECKO_API_KEY | ❌ | - | Pro API key |
| CMC_API_KEY | ❌ | - | CoinMarketCap key |
| ETHERSCAN_API_KEY | ❌ | - | Etherscan API key |
| BSCSCAN_API_KEY | ❌ | - | BSCScan API key |
| POLYGONSCAN_API_KEY | ❌ | - | PolygonScan API key |
| SQLITE_PATH | ❌ | ./data/bot.db | Database path |
| LOG_LEVEL | ❌ | info | Logging level |
| ALERT_JOB_CRON | ❌ | */1 * * * * | Alert check schedule |
| WATCH_JOB_CRON | ❌ | */5 * * * * | Watchlist schedule |
| RATE_LIMIT_REQUESTS_PER_MINUTE | ❌ | 30 | User rate limit |

### Startup Sequence

```
1. Load environment config (Zod validation)
2. Initialize SQLite database
3. Run pending migrations
4. Initialize price providers
5. Initialize security providers
6. Start scheduler jobs
7. Start Telegram bot polling
8. Log "Bot started" with provider status
```

### Health Check

```typescript
// GET /health (if HTTP server enabled)
{
  "status": "healthy",
  "uptime": 3600,
  "providers": {
    "coingecko": "healthy",
    "coincap": "healthy",
    "binance": "healthy"
  },
  "database": "connected",
  "lastAlertRun": "2024-01-15T10:30:00Z",
  "cacheSize": 234
}
```

---

## Future Enhancements

> Items to consider for future development. **Do not implement unless explicitly requested.**

### Potential Additions

| Feature | Description | Priority |
|---------|-------------|----------|
| More chains | Solana, Arbitrum, Base, Avalanche support | Medium |
| Inline keyboard buttons | Refresh, Set Alert, Security buttons on price cards | Low |
| Webhook mode | Switch from polling to webhooks for lower latency | Low |
| CoinMarketCap provider | Add CMC as price provider option | Low |
| Portfolio tracking | Track user portfolios (opt-in) | Low |
| Chart images | Generate price chart images | Low |

### Not Planned

| Feature | Reason |
|---------|--------|
| Admin permissions | Violates core privacy principle |
| Message reading | Violates core privacy principle |
| User tracking beyond leaderboard | Violates core privacy principle |
| Paid subscription features | Not in current scope |

### How to Request Features

1. User explicitly requests feature
2. Feature is added to this table with priority
3. When approved for development, follow [Development Rules](#development-rules)

---

## Appendix: Message Format Templates

### Telegram MarkdownV2 Escaping

```typescript
// Characters to escape: _ * [ ] ( ) ~ ` > # + - = | { } . !
function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
```

### Card Templates

See `src/utils/format.ts` for full implementation.

---

*Document Version: 1.0.0*
*Last Updated: 2024*
