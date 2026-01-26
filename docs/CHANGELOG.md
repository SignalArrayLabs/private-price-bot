# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup
- Privacy-first Telegram bot architecture
- Price provider layer (CoinGecko, CoinCap, Binance)
- Security provider layer (Etherscan, BSCScan, PolygonScan)
- SQLite database with migrations
- Command handlers for price, alerts, calls, security
- Rate limiting and caching
- Scheduled jobs for alerts and watchlist
- Comprehensive documentation

## [1.0.0] - TBD

### Added
- Core bot functionality
- Price lookups (`/p`, `/price`, `/chart`)
- Alert system (`/alert add/list/remove`)
- Call tracking (`/call`, `/calls`)
- Leaderboards (`/lb`)
- Security scanning (`/scan`, `/deployer`, `/websitecheck`)
- Group configuration (`/setdefault`, `/watch`)
- Mention triggering (`@BotName p BTC`)
- Privacy command (`/privacy`)
- Multi-provider fallback system
- In-memory and SQLite caching
- Per-user and per-group rate limiting
- Automated tests (unit and integration)
- Manual test checklist

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
| 1.0.0 | TBD | Initial release |

---

*For full architecture details, see [PLANNING.md](../PLANNING.md)*
