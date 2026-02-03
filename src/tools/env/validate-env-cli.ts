#!/usr/bin/env node

import { validateEnvFile } from './validate-env.js';
import { resolve } from 'path';

/**
 * CLI tool for validating .env file syntax
 * Usage: tsx tools/env/validate-env-cli.ts [path/to/.env]
 */

function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || '.env';
  const absolutePath = resolve(filePath);

  console.log(`🔍 Validating ${filePath}...`);

  const result = validateEnvFile(absolutePath);

  // Print errors
  if (result.errors.length > 0) {
    console.error('\n❌ Invalid .env syntax:\n');
    result.errors.forEach(err => {
      console.error(`  Line ${err.line}: ${err.reason}`);
      if (err.text) {
        console.error(`    > ${err.text}`);
      }
    });
    console.error('\nFix these errors and try again.\n');
    process.exit(1);
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:\n');
    result.warnings.forEach(warn => {
      console.warn(`  Line ${warn.line}: ${warn.reason}`);
      if (warn.text) {
        console.warn(`    > ${warn.text}`);
      }
    });
    console.warn('');
  }

  // Success
  console.log('✅ .env validation passed\n');
  process.exit(0);
}

main();
