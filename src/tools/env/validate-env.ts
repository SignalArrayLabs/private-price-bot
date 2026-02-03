import { readFileSync, existsSync } from 'fs';

export interface ValidationError {
  line: number;
  text: string;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validates a single line from an .env file
 */
function validateLine(line: string, lineNum: number): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const trimmed = line.trim();

  // Allow empty lines
  if (trimmed === '') {
    return { valid: true, errors, warnings };
  }

  // Allow comment lines
  if (trimmed.startsWith('#')) {
    return { valid: true, errors, warnings };
  }

  // Must contain = separator
  if (!trimmed.includes('=')) {
    errors.push({
      line: lineNum,
      text: line,
      reason: "Missing '=' separator (expected format: KEY=value)",
    });
    return { valid: false, errors, warnings };
  }

  // Split on first = only
  const eqIndex = trimmed.indexOf('=');
  const key = trimmed.substring(0, eqIndex);
  const value = trimmed.substring(eqIndex + 1);

  // Validate key format
  if (key.trim() !== key) {
    errors.push({
      line: lineNum,
      text: line,
      reason: `Key has leading/trailing spaces: "${key}"`,
    });
    return { valid: false, errors, warnings };
  }

  // Key must be UPPERCASE_SNAKE_CASE
  const KEY_REGEX = /^[A-Z_][A-Z0-9_]*$/;
  if (!KEY_REGEX.test(key)) {
    errors.push({
      line: lineNum,
      text: line,
      reason: `Invalid key format: "${key}" (must be UPPERCASE_SNAKE_CASE)`,
    });
    return { valid: false, errors, warnings };
  }

  // Check for spaces around = (common mistake)
  if (trimmed.includes(' =') || trimmed.includes('= ')) {
    errors.push({
      line: lineNum,
      text: line,
      reason: 'No spaces allowed around "=" (use KEY=value, not KEY = value)',
    });
    return { valid: false, errors, warnings };
  }

  // Empty values are warnings
  const valueContent = value.split('#')[0].trim(); // Remove inline comments
  if (valueContent === '') {
    warnings.push({
      line: lineNum,
      text: line,
      reason: `Empty value for key "${key}"`,
    });
  }

  return { valid: true, errors, warnings };
}

/**
 * Validates an entire .env file
 */
export function validateEnvFile(filePath: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if file exists
  if (!existsSync(filePath)) {
    errors.push({
      line: 0,
      text: '',
      reason: `File not found: ${filePath}`,
    });
    return { valid: false, errors, warnings };
  }

  // Read file
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (error) {
    errors.push({
      line: 0,
      text: '',
      reason: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return { valid: false, errors, warnings };
  }

  // Validate line by line
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const result = validateLine(line, lineNum);

    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
