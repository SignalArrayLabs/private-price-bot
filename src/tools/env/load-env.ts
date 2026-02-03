import { config as dotenvConfig } from 'dotenv';
import { validateEnvFile } from './validate-env.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface LoadEnvResult {
  envFile: string;
  envSource: string;
}

/**
 * Detects which .env file to use based on what exists
 */
function detectEnvFile(): string {
  // Check in order of preference
  if (existsSync('.env')) return '.env';
  if (existsSync('.env.development')) return '.env.development';
  if (existsSync('.env.production')) return '.env.production';

  // Default to .env (will fail validation if missing)
  return '.env';
}

/**
 * Determines the environment source name from the file path
 */
function detectEnvSource(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';

  if (fileName === '.env.development') return 'development';
  if (fileName === '.env.production') return 'production';
  if (fileName === '.env.test') return 'test';

  return 'default';
}

/**
 * Formats validation errors into a readable string
 */
function formatErrors(errors: Array<{ line: number; text: string; reason: string }>): string {
  return errors
    .map(err => `  Line ${err.line}: ${err.reason}\n    > ${err.text}`)
    .join('\n\n');
}

/**
 * Loads and validates environment variables from .env file
 *
 * @param options.required - If true, throws if .env file is missing (default: true)
 * @param options.envFile - Override auto-detection with specific file path
 * @returns LoadEnvResult with envFile path and envSource name
 * @throws Error if validation fails or file is missing (when required=true)
 */
export function loadValidatedEnv(options?: {
  required?: boolean;
  envFile?: string;
}): LoadEnvResult {
  const required = options?.required !== false; // Default to true

  // 1. Detect or use specified env file
  const envFile = options?.envFile || detectEnvFile();
  const absolutePath = resolve(envFile);

  // 2. Validate syntax before loading
  const validation = validateEnvFile(absolutePath);

  if (!validation.valid) {
    const errorMessage = `Invalid .env file syntax at ${absolutePath}\n\n${formatErrors(validation.errors)}\n\nFix these errors and try again.`;
    throw new Error(errorMessage);
  }

  // 3. Load with dotenv
  const result = dotenvConfig({ path: absolutePath });

  if (result.error && required) {
    throw new Error(`Failed to load .env file: ${result.error.message}`);
  }

  // 4. Return metadata
  return {
    envFile: absolutePath,
    envSource: detectEnvSource(envFile),
  };
}
