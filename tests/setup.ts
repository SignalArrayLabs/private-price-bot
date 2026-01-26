import { beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.TELEGRAM_BOT_TOKEN = 'test-token-12345';
process.env.PRICE_PROVIDER = 'coingecko';
process.env.SQLITE_PATH = ':memory:';
process.env.LOG_LEVEL = 'error';

// Clean up after each test
afterEach(() => {
  // Reset any mocks if needed
});
