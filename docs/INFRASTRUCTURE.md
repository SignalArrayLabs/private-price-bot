# Infrastructure & Deployment

> Deployment/ops runbook for Hetzner server, SSH access, and process management.

---

## Server Details

| Property | Value |
|----------|-------|
| **Provider** | Hetzner Cloud |
| **Project** | signal-array-bots |
| **Server Name** | ubuntu-8gb-nbg1-1 |
| **IPv4** | 116.203.227.198 |
| **Specs** | 4 VCPU, 8GB RAM, 160GB Disk |
| **Cost** | €12.90/month |
| **Location** | Nuremberg, Germany (nbg1-dc3) |

---

## SSH Access

```bash
ssh root@116.203.227.198
```

---

## Dev/Prod Environments

| Environment | Bot | Token | Location | Command |
|-------------|-----|-------|----------|---------|
| **Production** | @SignalArrayPriceBot | Production | Hetzner | `npm run start:prod` |
| **Development** | @SignalArrayPriceDevBot | Dev | MacBook | `npm run dev` |

**IMPORTANT**: Cannot run two instances with the same token. Use separate bot tokens.

---

## BotFather Configuration

**REQUIRED: Enable privacy mode via BotFather.**

```
1. Open @BotFather in Telegram
2. Send /mybots
3. Select your bot
4. Bot Settings → Group Privacy → Turn ON
```

This ensures the bot **cannot see group messages** — only commands directed at it. This is non-negotiable and core to our privacy-first USP.

Without privacy mode enabled, Telegram sends ALL group messages to the bot, which violates our privacy guarantees.

---

## Development Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     MACBOOK (Development)                       │
│                                                                 │
│  1. Write code                                                  │
│  2. npm run dev  (uses @SignalArrayPriceDevBot)                │
│  3. Test in Telegram with DEV bot                              │
│  4. Confirm working                                             │
│  5. git add . && git commit && git push                        │
└───────────────────────────────────────────────────────────────┬─┘
                                                                │
                                                           git push
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │   GitHub    │
                                                         └──────┬──────┘
                                                                │
                                                           git pull
                                                                │
                                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     HETZNER (Production)                        │
│                                                                 │
│  1. ssh root@116.203.227.198                                   │
│  2. cd /root/bots/private-price-bot                            │
│  3. git pull                                                    │
│  4. npm install (if deps changed)                              │
│  5. pm2 restart private-price-bot                              │
│                                                                 │
│  Production bot runs 24/7: @SignalArrayPriceBot                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Local Setup (MacBook)

### 1. Create Dev Bot

1. Message `@BotFather` on Telegram
2. Send `/newbot`
3. Name it (e.g., "SignalArrayPriceDevBot")
4. Save the token

### 2. Configure Environment

```bash
cp .env.example .env.development

# Edit .env.development
nano .env.development
```

Contents:
```
TELEGRAM_BOT_TOKEN=<dev-bot-token>
SQLITE_PATH=./data/bot-dev.db
LOG_LEVEL=debug
```

### 3. Run Dev Bot

```bash
npm run dev
```

### 4. Test

Open Telegram → @YourDevBot → `/p BTC`

---

## Production Deployment (Hetzner)

### Initial Setup

```bash
# SSH into server
ssh root@116.203.227.198

# Create bot directory
mkdir -p /root/bots
cd /root/bots

# Clone repo
git clone https://github.com/SignalArrayLabs/private-price-bot.git
cd private-price-bot

# Install dependencies
npm install

# Build
npm run build

# Create production env
cp .env.example .env
nano .env  # Add production token
```

### PM2 Process Manager

```bash
# Start bot
pm2 start dist/index.js --name private-price-bot

# Save process list (survives reboot)
pm2 save
pm2 startup
```

### Deploy Updates

```bash
ssh root@116.203.227.198
cd /root/bots/private-price-bot
git pull
npm install        # Only if package.json changed
npm run build      # Only if TypeScript changed
pm2 restart private-price-bot
```

---

## PM2 Commands Reference

| Command | Description |
|---------|-------------|
| `pm2 list` | View running bots |
| `pm2 logs private-price-bot` | View logs |
| `pm2 logs private-price-bot --lines 50` | Last 50 lines |
| `pm2 restart private-price-bot` | Restart bot |
| `pm2 stop private-price-bot` | Stop bot |
| `pm2 delete private-price-bot` | Remove from PM2 |

---

## Environment Files

### .env.development (MacBook - gitignored)
```
TELEGRAM_BOT_TOKEN=<dev-bot-token>
PRICE_PROVIDER=coingecko
SQLITE_PATH=./data/bot-dev.db
LOG_LEVEL=debug
```

### .env.production (Hetzner - gitignored)
```
TELEGRAM_BOT_TOKEN=<production-bot-token>
PRICE_PROVIDER=coingecko
SQLITE_PATH=./data/bot.db
LOG_LEVEL=info
```

---

## Monitoring

### Check Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs private-price-bot --lines 100
```

### System Resources
```bash
htop
```

---

## Firewall

Required:
- SSH (port 22) - inbound
- HTTPS (port 443) - outbound (Telegram API, CoinGecko, DexScreener)

No inbound ports needed for polling mode.

---

## Troubleshooting

### Bot not responding
1. Check token in `.env`
2. Verify bot is running: `pm2 status`
3. Check logs: `pm2 logs private-price-bot`

### 409 Conflict error
Two instances running with same token. Stop one:
- Local: `Ctrl+C`
- Server: `pm2 stop private-price-bot`

### Permission denied
```bash
mkdir -p data
chmod 755 data
```

---

## Hetzner Console

**URL**: https://console.hetzner.cloud/projects/13247557/servers/118552499/overview

Actions available: Start, Stop, Restart, Rescue, Delete

---

*Last updated: January 2026*
