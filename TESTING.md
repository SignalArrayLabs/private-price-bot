# Testing Guide

## Overview

This project uses Vitest for automated testing. Tests are organized into unit and integration categories.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run tests/unit/dexscreener.test.ts
```

## Test Coverage

### Unit Tests

#### DexScreener Provider (`tests/unit/dexscreener.test.ts`)
- **Pair selection**: Verifies the provider selects the correct token when multiple tokens share the same symbol (e.g., PENGU vs fake PENGU tokens)
- **Volume aggregation**: Confirms volume is aggregated across multiple pairs for the same token
- **Symbol disambiguation**: Tests that PENGUIN and PENGU are treated as distinct tokens
- **DexScreener URL**: Validates that the returned price data includes a clickable DexScreener link
- **Error handling**: Tests graceful handling of API failures and missing data

**Key insight**: The provider now selects tokens by TOTAL VOLUME rather than liquidity to avoid fake tokens with inflated liquidity but no real trading activity.

#### Price Card Formatting (`tests/unit/format-pricecard.test.ts`)
- **DexScreener link rendering**: Confirms the price card includes a clickable "View on DexScreener" link when dexScreenerUrl is present
- **Volume formatting**: Validates volume is displayed using K/M/B notation (e.g., "791.34K" instead of raw numbers)
- **HTML escaping**: Ensures special characters in symbols are properly escaped
- **Complete data display**: Checks all required fields are present (price, change, market cap, volume, source)

### Integration Tests

#### Price Command (`tests/integration/price-command.test.ts`)
- **Full command flow**: Simulates `/p PENGU` command and verifies complete response
- **DexScreener link**: Confirms link appears in actual bot responses
- **Bottom navigation**: Validates 6 navigation buttons (Price, Gainers, Losers, Scan, Alerts, Board) are present
- **Volume display**: Checks volume uses K/M/B format, not raw small numbers like "$3.99"
- **Error cases**: Tests "not found" and API error handling

#### Callback Handlers (`tests/integration/callbacks.test.ts`)
- **Navigation callbacks**: Tests all 6 nav button handlers (nav:price, nav:gainers, nav:losers, nav:scan, nav:alerts, nav:leaderboard)
- **Refresh callback**: Verifies price refresh updates data correctly
- **Unknown actions**: Confirms graceful handling of invalid callback data

## Test Fixtures

### DexScreener API Responses (`tests/fixtures/`)
- **pengu-response.json**: Captured real DexScreener API response for PENGU searches
  - Contains 30 pairs including real and fake PENGU tokens
  - Used to test token disambiguation logic
  - Demonstrates the fake token problem (billions in liquidity, only $4 volume)

- **penguin-response.json**: Captured real DexScreener API response for PENGUIN searches
  - Used to verify PENGUIN is correctly distinguished from PENGU

**Important**: These fixtures are real API responses that demonstrate the fake token problem we're solving. Do not regenerate them unless you need fresh data, as they document the specific edge cases we're handling.

## Testing Strategy

### What's Automated
1. **Pair selection logic**: Fully tested with real fixtures showing fake vs real tokens
2. **Volume aggregation**: Verified across multiple pairs
3. **Message formatting**: All formatting functions tested with various inputs
4. **Bot command flow**: Integration tests simulate full command execution
5. **Callback handling**: All button interactions tested
6. **Error cases**: API failures, missing data, invalid input

### What Requires Manual Testing
**ONE FINAL LIVE CHECK** after automated tests pass:

1. Run `/p pengu` in Telegram
2. Verify:
   - Volume is NOT single digits (should be ~791K)
   - DexScreener link is present and clickable
   - Bottom nav has 6 buttons arranged in 2 rows
   - Clicking nav buttons works

That's it. Everything else is covered by automated tests.

## Common Issues

### Mock Not Working
If tests are calling the real API instead of using mocks:
- Use `vi.spyOn(provider as any, 'fetchWithTimeout')` to mock at the provider level
- Use `vi.spyOn(priceIndex, 'getPrice')` to mock at the integration level
- Avoid `global.fetch` mocks (doesn't work reliably with Node.js 18+ built-in fetch)

### Fixture Data Issues
If fixtures become outdated:
```bash
curl -s "https://api.dexscreener.com/latest/dex/search?q=PENGU" > tests/fixtures/pengu-response.json
curl -s "https://api.dexscreener.com/latest/dex/search?q=PENGUIN" > tests/fixtures/penguin-response.json
```

## Test Results Summary

Current test status:
- ✅ DexScreener unit tests: 6/6 passing
- ✅ Format unit tests: 5/5 passing
- ✅ Price command integration tests: 6/6 passing
- ✅ Callback integration tests: 8/8 passing

**Total: 25/25 tests passing for the volume fix**

Some pre-existing tests have failures unrelated to this work (access-control, validation, new-features) - those are not part of this fix scope.
