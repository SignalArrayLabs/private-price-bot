// Standalone migration script
import { initDb, closeDb } from './index.js';
import { logger } from '../utils/logger.js';

async function main() {
  try {
    logger.info('Starting database migration...');
    initDb();
    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
