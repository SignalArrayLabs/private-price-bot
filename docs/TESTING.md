# Testing Strategy

> References [PLANNING.md](../PLANNING.md) for architecture details.

## Table of Contents

1. [Overview](#overview)
2. [Test Categories](#test-categories)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [Manual Test Checklist](#manual-test-checklist)
6. [Test Coverage Goals](#test-coverage-goals)

---

## Overview

### Testing Framework

- **Test Runner**: Vitest
- **Mocking**: MSW (Mock Service Worker) for API mocks
- **Assertions**: Vitest built-in

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/tests/unit/providers.test.ts

# Run with coverage
npm test -- --coverage
```

---

## Test Categories

### Test Type Matrix

| Type | Scope | Mocked | Speed | Frequency |
|------|-------|--------|-------|-----------|
| Unit | Function/Class | External APIs | Fast | On every change |
| Integration | Module interaction | External APIs | Medium | On commit |
| Manual | Full system | None | Slow | On release |

---

## Unit Tests

### Coverage Areas

#### 1. Command Parsing (`tests/unit/parsing.test.ts`)

```typescript
// Test cases
describe('parseCommand', () => {
  it('parses /p BTC correctly');
  it('parses /p 0x1234... ethereum correctly');
  it('handles missing arguments');
  it('handles invalid chain names');
  it('parses mention format @BotName p BTC');
});
```

**Input/Output Examples:**

| Input | Expected Output |
|-------|-----------------|
| `/p BTC` | `{ command: 'price', args: ['BTC'], chain: undefined }` |
| `/p 0x1234 ethereum` | `{ command: 'price', args: ['0x1234'], chain: 'ethereum' }` |
| `/alert add BTC above 70000` | `{ command: 'alert', action: 'add', ... }` |

#### 2. Provider Fallback (`tests/unit/providers.test.ts`)

```typescript
describe('PriceProvider fallback', () => {
  it('returns CoinGecko data when healthy');
  it('falls back to CoinCap when CoinGecko fails');
  it('falls back to Binance when both fail');
  it('returns null when all providers fail');
  it('marks provider as down after failure');
  it('retries down provider after backoff period');
});
```

#### 3. Caching TTL (`tests/unit/cache.test.ts`)

```typescript
describe('Cache', () => {
  it('returns cached data within TTL');
  it('returns null for expired cache');
  it('memory cache has priority over SQLite');
  it('cleans expired entries on cleanup job');
});
```

#### 4. Leaderboard Calculation (`tests/unit/leaderboard.test.ts`)

```typescript
describe('Leaderboard', () => {
  it('calculates multiple correctly (current/call price)');
  it('ranks users by average multiple');
  it('handles users with no calls');
  it('limits results to top 10');
});
```

**Calculation Formula:**
```
multiple = currentPrice / callPrice
avgMultiple = sum(multiples) / callCount
```

#### 5. Markdown Formatting (`tests/unit/format.test.ts`)

```typescript
describe('formatMarkdownV2', () => {
  it('escapes special characters');
  it('formats price with appropriate decimals');
  it('formats large numbers with K/M/B suffix');
  it('handles negative percentages');
});
```

**Escape Test Cases:**

| Input | Escaped Output |
|-------|----------------|
| `_underscore_` | `\_underscore\_` |
| `*bold*` | `\*bold\*` |
| `[link](url)` | `\[link\]\(url\)` |
| `100.50` | `100\.50` |

---

## Integration Tests

### API Mock Setup

```typescript
// tests/setup.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  // CoinGecko mock
  http.get('https://api.coingecko.com/api/v3/coins/bitcoin', () => {
    return HttpResponse.json({
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      market_data: {
        current_price: { usd: 67000 },
        price_change_24h: 1000,
        price_change_percentage_24h: 1.5,
        market_cap: { usd: 1320000000000 },
        total_volume: { usd: 28000000000 },
      },
    });
  }),

  // CoinCap mock
  http.get('https://api.coincap.io/v2/assets/bitcoin', () => {
    return HttpResponse.json({
      data: {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        priceUsd: '67000',
        changePercent24Hr: '1.5',
      },
    });
  }),

  // Etherscan mock
  http.get('https://api.etherscan.io/api', ({ request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'getsourcecode') {
      return HttpResponse.json({
        status: '1',
        result: [{
          ContractName: 'TestToken',
          SourceCode: 'contract TestToken {}',
          ABI: '[]',
        }],
      });
    }
    return HttpResponse.json({ status: '0', result: [] });
  }),
];

export const server = setupServer(...handlers);
```

### Integration Test Cases

```typescript
// tests/integration/price-flow.test.ts
describe('Price lookup flow', () => {
  it('fetches price and caches result');
  it('uses cache on subsequent requests');
  it('falls back on provider failure');
  it('returns formatted message');
});

// tests/integration/alert-flow.test.ts
describe('Alert flow', () => {
  it('creates alert in database');
  it('triggers alert when price crosses threshold');
  it('respects cooldown period');
  it('sends notification to correct chat');
});
```

---

## Manual Test Checklist

### Pre-Test Setup

1. [ ] Create test Telegram group
2. [ ] Add bot to group **without admin permissions**
3. [ ] Verify bot appears as regular member
4. [ ] Set up `.env` with test bot token

### Core Functionality Tests

#### Privacy Verification

| # | Test | Expected | Pass |
|---|------|----------|------|
| 1 | Send regular message (not command) | Bot ignores message | ☐ |
| 2 | Check bot permissions in group | No admin privileges | ☐ |
| 3 | Run `/privacy` | Shows privacy policy | ☐ |
| 4 | Check logs after messages | No message bodies logged | ☐ |

#### Price Commands

| # | Test | Expected | Pass |
|---|------|----------|------|
| 5 | `/p BTC` | Returns BTC price card | ☐ |
| 6 | `/price ETH` | Returns ETH price card | ☐ |
| 7 | `@BotName p BTC` | Returns BTC price card (mention) | ☐ |
| 8 | `/p 0x...` (valid address) | Returns token price | ☐ |
| 9 | `/p INVALIDTOKEN` | Returns "not found" error | ☐ |
| 10 | `/chart BTC` | Returns chart link/sparkline | ☐ |

#### Group Configuration

| # | Test | Expected | Pass |
|---|------|----------|------|
| 11 | `/setdefault BTC` | Sets default token | ☐ |
| 12 | `/default` | Shows BTC price | ☐ |
| 13 | `/watch add ETH` | Adds to watchlist | ☐ |
| 14 | `/watch list` | Shows ETH in list | ☐ |
| 15 | `/watch remove ETH` | Removes from list | ☐ |

#### Alerts

| # | Test | Expected | Pass |
|---|------|----------|------|
| 16 | `/alert add BTC above 100000` | Creates alert | ☐ |
| 17 | `/alert list` | Shows created alert | ☐ |
| 18 | `/alert remove <id>` | Removes alert | ☐ |
| 19 | Wait for alert trigger | Notification sent when triggered | ☐ |

#### Calls & Leaderboard

| # | Test | Expected | Pass |
|---|------|----------|------|
| 20 | `/call PEPE` | Records call with current price | ☐ |
| 21 | `/call BTC 65000` | Records call with specified price | ☐ |
| 22 | `/calls` | Shows recent calls | ☐ |
| 23 | `/lb` | Shows leaderboard | ☐ |

#### Security Commands

| # | Test | Expected | Pass |
|---|------|----------|------|
| 24 | `/scan 0x...` (known token) | Shows security card | ☐ |
| 25 | `/deployer 0x...` | Shows deployer info | ☐ |
| 26 | `/websitecheck https://...` | Shows website analysis | ☐ |
| 27 | `/twittercheck @handle` | Shows limited mode warning | ☐ |

#### Utility Commands

| # | Test | Expected | Pass |
|---|------|----------|------|
| 28 | `/help` | Shows command list | ☐ |
| 29 | `/status` | Shows bot status | ☐ |
| 30 | `/privacy` | Shows privacy statement | ☐ |

### Edge Cases

| # | Test | Expected | Pass |
|---|------|----------|------|
| 31 | Rapid commands (rate limit) | Rate limit message | ☐ |
| 32 | Invalid command format | Helpful error message | ☐ |
| 33 | Bot restart recovery | Commands work after restart | ☐ |

### Log Verification

After completing tests, verify:

| # | Check | Expected | Pass |
|---|-------|----------|------|
| 34 | `grep -r "message.text" logs/` | No results | ☐ |
| 35 | Check logs for API keys | Keys are [REDACTED] | ☐ |
| 36 | Check DB for message content | No message bodies stored | ☐ |

---

## Test Coverage Goals

### Minimum Coverage Requirements

| Area | Target | Priority |
|------|--------|----------|
| Command parsing | 90% | High |
| Provider fallback | 85% | High |
| Cache logic | 80% | Medium |
| Formatting | 75% | Medium |
| Database operations | 70% | Medium |

### Coverage Commands

```bash
# Generate coverage report
npm test -- --coverage

# View coverage in browser
npm test -- --coverage --coverage.reporter=html
open coverage/index.html
```

---

## Appendix: Test Data

### Mock Tokens

```typescript
export const MOCK_TOKENS = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 67000,
    change24h: 1.5,
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3500,
    change24h: -0.5,
  },
  PEPE: {
    symbol: 'PEPE',
    name: 'Pepe',
    price: 0.00001234,
    change24h: 15.5,
  },
};
```

### Mock Contract

```typescript
export const MOCK_CONTRACT = {
  address: '0x1234567890abcdef1234567890abcdef12345678',
  chain: 'ethereum',
  isVerified: true,
  isProxy: false,
  hasOwnerFunction: true,
  hasMintFunction: true,
  riskLevel: 'medium',
};
```

---

## Current Test Status

**Last Run: February 2026**

```
Test Files  14 passed (14)
     Tests  177 passed (177)
  Duration  ~4s
```

### Test File Breakdown

| Test File | Tests | Status |
|-----------|-------|--------|
| price-flow.test.ts | 4 | ✅ |
| cache.test.ts | 5 | ✅ |
| access-control.test.ts | 19 | ✅ |
| format.test.ts | 28 | ✅ |
| validation.test.ts | 30 | ✅ |
| new-features.test.ts | 36 | ✅ |
| onchain-movers.test.ts | 4 | ✅ |
| dexscreener.test.ts | 6 | ✅ |
| leaderboard.test.ts | 14 | ✅ |
| format-pricecard.test.ts | 5 | ✅ |
| providers.test.ts | 8 | ✅ |
| onchain-callback.test.ts | 4 | ✅ |
| callbacks.test.ts | 8 | ✅ |
| price-command.test.ts | 6 | ✅ |

**Total: 177/177 passing (100%)**

---

*Document Version: 1.1.0*
*Last Updated: February 2026*
*References: [PLANNING.md](../PLANNING.md)*
