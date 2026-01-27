# Step-by-Step Setup Guide

## 1. Create Your Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Choose a name (e.g., "My Crypto Price Bot")
4. Choose a username (must end in `bot`, e.g., `MyCryptoPriceBot`)
5. BotFather will give you a token like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
6. **Save this token** - you'll need it!

## 2. Configure the Bot

```bash
# Copy the example config
cp .env.example .env

# Edit .env and add your token
# On Linux/Mac:
nano .env
# Or use any text editor
```

Your `.env` should look like:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
PRICE_PROVIDER=coingecko
SQLITE_PATH=./data/bot.db
LOG_LEVEL=info
```

## 3. Run the Bot

```bash
# Install dependencies (if not done)
npm install

# Start in development mode
npm run dev
```

You should see:
```
{"level":30,"msg":"Starting Private Price Bot..."}
{"level":30,"msg":"Initializing database..."}
{"level":30,"msg":"Bot started successfully"}
```

## 4. Test in Telegram

1. Open Telegram
2. Search for your bot by its @username
3. Send `/start` - you should get a welcome message
4. Send `/p BTC` - you should get Bitcoin price

## 5. Add to a Group

1. Create a test group (or use existing)
2. Click group name → Add members
3. Search for your bot
4. Add it (DO NOT make admin)
5. Test: `/p ETH`

## Common Issues

### "Bot not responding"
- Check your token is correct in `.env`
- Make sure bot is running (`npm run dev`)
- Check for errors in terminal

### "Permission denied"
- You may need to create the data folder: `mkdir -p data`

### "Rate limited"
- Free CoinGecko API has limits
- Wait a minute and try again
- Consider adding API keys for higher limits

## Optional: Add API Keys for Better Limits

Edit `.env` to add:
```
# Get free key from https://etherscan.io/apis
ETHERSCAN_API_KEY=your_key_here

# Get free key from https://bscscan.com/apis
BSCSCAN_API_KEY=your_key_here
```
