# Deployment Guide - Hetzner Server

## Server Details

| Property | Value |
|----------|-------|
| **Provider** | Hetzner Cloud |
| **Project** | signal-array-bots |
| **Server ID** | #118552499 |
| **Server Name** | ubuntu-8gb-nbg1-1 |
| **IPv4** | 116.203.227.198 |
| **IPv6** | 2a01:4f8:1c0c:43a5::/64 |
| **Specs** | 4 VCPU, 8GB RAM, 160GB Disk |
| **Cost** | €12.90/month |
| **Location** | Nuremberg, Germany (nbg1-dc3) |
| **Network Zone** | eu-central |

## SSH Access

```bash
ssh root@116.203.227.198
# or
ssh root@ubuntu-8gb-nbg1-1
```

## Deployed Bots

This server hosts multiple Signal Array bots:

| Bot | Directory | Status |
|-----|-----------|--------|
| private-price-bot | `/root/bots/private-price-bot` | TBD |
| (other bots) | TBD | TBD |

## Process Manager

**Using PM2** (recommended for Node.js bots):

```bash
# View running bots
pm2 list

# Stop a bot
pm2 stop private-price-bot

# Start a bot
pm2 start private-price-bot

# Restart a bot
pm2 restart private-price-bot

# View logs
pm2 logs private-price-bot

# Save process list (survives reboot)
pm2 save
```

## Deployment Process

### Manual Deploy (git pull)

```bash
# SSH into server
ssh root@116.203.227.198

# Navigate to project
cd /root/bots/private-price-bot

# Pull latest code
git pull origin claude/telegram-privacy-bot-ds57Y

# Install dependencies (if package.json changed)
npm install

# Restart bot
pm2 restart private-price-bot
```

### Environment Variables

Production `.env` file location: `/root/bots/private-price-bot/.env`

Key variables:
```
TELEGRAM_BOT_TOKEN=<production token>
PRICE_PROVIDER=coingecko
LOG_LEVEL=info
SQLITE_PATH=./data/bot.db
```

## Development vs Production

| Environment | Bot Token | Method | Location |
|-------------|-----------|--------|----------|
| **Production** | Main token | Polling/PM2 | Hetzner server |
| **Development** | Dev token (separate bot) | Polling/npm run dev | Local MacBook |

**IMPORTANT**: You cannot run two instances with the same bot token. Use separate bot tokens for dev and production.

## Monitoring

### Check if bot is running
```bash
pm2 status
```

### View recent logs
```bash
pm2 logs private-price-bot --lines 50
```

### Check system resources
```bash
htop
```

## Firewall

Hetzner firewall should allow:
- SSH (port 22)
- HTTPS outbound (for Telegram API, CoinGecko, DexScreener)

No inbound ports needed for polling mode. If using webhooks, open port 443.

---

## Hetzner Console

- **URL**: https://console.hetzner.cloud/projects/13247557/servers/118552499/overview
- **Actions**: Start, Stop, Restart, Rescue, Delete available in console

---

*Last updated: January 2026*
