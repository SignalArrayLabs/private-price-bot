# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-13

### Added
- **Solana chain support** via Solscan and DexScreener providers
- **DexScreener price provider** for DEX/OnChain token data
- **OnChain movers** (`/gainers`, `/losers`) using DexScreener as primary source
- **RugCheck security provider** for additional token security checks
- **Solscan security provider** for Solana token analysis
- **Admin command suite**: `/selftest`, `/approve`, `/revoke`, `/users`, `/checkuser`, `/payments`
- **User identity command** (`/whoami`)
- **Self-test system** with live API verification for all 11 modules

### Changed
- CoinGecko movers marked as degraded, DexScreener OnChain is now primary
- Updated documentation to reflect all providers and commands
- Test suite expanded to 177 tests (100% passing)

### Fixed
- Volume display using proper K/M/B notation instead of raw numbers
- Token disambiguation for symbols with multiple DEX pairs (e.g., PENGU)
- DexScreener URL inclusion in price cards

## [1.0.0] - 2026-01-27

### Added
- Core bot functionality
- Privacy-first Telegram bot architecture (no admin permissions required)
- Price lookups (`/p`, `/price`, `/chart`, `/default`)
- Alert system (`/alert add/list/remove`)
- Call tracking (`/call`, `/calls`)
- Leaderboards (`/lb`)
- Security scanning (`/scan`, `/deployer`, `/websitecheck`, `/twittercheck`)
- Group configuration (`/setdefault`, `/watch`)
- Market data commands (`/gas`, `/trending`, `/fgi`, `/convert`, `/ath`)
- Mention triggering (`@BotName p BTC`)
- Privacy command (`/privacy`)
- Multi-provider fallback system (CoinGecko → CoinCap → Binance)
- Security providers (Etherscan, BSCScan, PolygonScan)
- In-memory and SQLite caching
- Per-user and per-group rate limiting
- Scheduled jobs for alerts and watchlist
- Automated tests (unit and integration)

### Security
- No admin permissions required
- No message content logging
- No raw chat text storage
- API key redaction in logs
- Input validation with Zod

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.1.0 | 2026-02-13 | Solana support, DexScreener, admin commands, selftest |
| 1.0.0 | 2026-01-27 | Initial release |

---

*For full architecture details, see [PLANNING.md](../PLANNING.md)*
