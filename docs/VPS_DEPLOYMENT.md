# VPS Deployment - Private Price Bot

## Multi-Bot Server Setup

This bot runs on the shared **signal-array-bots** Hetzner VPS alongside:
- market-intelligence
- signal-trader (SignalBotTGTrader)
- prediction-markets

## Server Details

| Item | Value |
|------|-------|
| Hetzner Project | signal-array-bots |
| Server | tg-bots-prod |
| VPS Plan | CX32 (4 vCPU, 8GB RAM) |
| OS | Ubuntu 24.04 LTS |
| User | botrunner |
| Bot Path | `/home/botrunner/bots/private-price-bot` |
| Service | `private-price-bot.service` |
| Log | `/home/botrunner/logs/private-price-bot.log` |

## Quick Commands

```bash
# SSH into server
ssh botrunner@YOUR_VPS_IP

# Check this bot's status
sudo systemctl status private-price-bot

# Restart this bot
sudo systemctl restart private-price-bot

# View logs
tail -f ~/logs/private-price-bot.log

# Update from GitHub
~/update-bot.sh private-price-bot
```

## Systemd Service

Located at `/etc/systemd/system/private-price-bot.service`:

```ini
[Unit]
Description=Private Price Bot
After=network.target

[Service]
Type=simple
User=botrunner
Group=botrunner
WorkingDirectory=/home/botrunner/bots/private-price-bot
Environment=PATH=/home/botrunner/bots/private-price-bot/venv/bin
ExecStart=/home/botrunner/bots/private-price-bot/venv/bin/python -m src.bot
Restart=always
RestartSec=10
StandardOutput=append:/home/botrunner/logs/private-price-bot.log
StandardError=append:/home/botrunner/logs/private-price-bot.log

[Install]
WantedBy=multi-user.target
```

## Full Setup Guide

See the complete multi-bot deployment guide in:
`market-intelligence/docs/HETZNER_DEPLOYMENT.md`
