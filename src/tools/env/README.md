# Environment Safety Tools

## Overview

This directory contains tools for validating and safely loading `.env` files to prevent configuration drift and runtime errors.

**Problem**: `.env` files can contain invalid syntax (like `CLAUDE.md` or `KEY = value`) which breaks bash scripts but silently passes Node's dotenv parser, causing dev/prod environment drift.

**Solution**: Validate `.env` syntax before loading. Fail fast with clear error messages.

---

## Files

- **validate-env.ts**: Core validation logic
- **validate-env-cli.ts**: CLI wrapper for npm scripts
- **load-env.ts**: Safe replacement for `dotenvConfig()`
- **example.env**: Template with proper format
- **README.md**: This file

---

## Usage

### In package.json Scripts

Add validation gates to your npm scripts:

```json
{
  "scripts": {
    "validate:env": "tsx tools/env/validate-env-cli.ts",
    "dev": "npm run validate:env && tsx src/index.ts",
    "start": "npm run validate:env && node dist/index.js"
  }
}
```

Now every run validates `.env` first. Invalid syntax = immediate error.

### In Code

Replace `dotenvConfig()` with the safe loader:

```typescript
// Before
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

// After
import { loadValidatedEnv } from './tools/env/load-env.js';

const { envFile, envSource } = loadValidatedEnv();
console.log(`Loaded ${envSource} config from ${envFile}`);
```

---

## Validation Rules

Your `.env` file must follow these rules:

### ✅ Valid Format

```env
# Comments start with #
TELEGRAM_BOT_TOKEN=your_token_here
PRICE_PROVIDER=coingecko

# Empty lines are fine

# Values with spaces need quotes
DATABASE_PATH="./data/my bot.db"

# Inline comments after values
LOG_LEVEL=info  # This is the log level
```

### ❌ Invalid Format

```env
CLAUDE.md                    # ❌ No = separator
KEY = value                  # ❌ Spaces around =
=value                       # ❌ Missing key
key=value                    # ❌ Lowercase key
MY-KEY=value                 # ❌ Hyphens not allowed
source .env                  # ❌ Bash commands not allowed
```

### Key Format Rules

- Must be `UPPERCASE_SNAKE_CASE`
- Start with letter or underscore
- Only letters, numbers, underscores
- Examples: `API_KEY`, `MAX_RETRIES`, `_PRIVATE_VAR`

### Value Rules

- No spaces around `=` (use `KEY=value` not `KEY = value`)
- Empty values allowed (warning only)
- Quotes optional unless value has spaces
- Inline comments allowed after `#`

---

## CLI Usage

Validate a specific file:

```bash
# Validate .env
npm run validate:env

# Validate custom file
tsx tools/env/validate-env-cli.ts .env.production

# Validate with explicit path
tsx tools/env/validate-env-cli.ts /path/to/.env
```

**Exit Codes**:
- `0` = Valid
- `1` = Invalid syntax (errors printed)

---

## API Reference

### `validateEnvFile(filePath: string): ValidationResult`

Validates an .env file and returns detailed results.

```typescript
import { validateEnvFile } from './tools/env/validate-env.js';

const result = validateEnvFile('.env');

if (!result.valid) {
  console.error('Errors:', result.errors);
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

### `loadValidatedEnv(options?): LoadEnvResult`

Validates and loads .env file in one step.

```typescript
import { loadValidatedEnv } from './tools/env/load-env.js';

// Auto-detect .env file
const { envFile, envSource } = loadValidatedEnv();

// Use specific file
const result = loadValidatedEnv({ envFile: '.env.production' });

// Optional loading (don't throw if missing)
const optional = loadValidatedEnv({ required: false });
```

**Options**:
- `required`: Boolean, default `true`. Throw if file missing/invalid.
- `envFile`: String, override auto-detection with specific path.

**Returns**:
- `envFile`: Absolute path to loaded file
- `envSource`: Environment name (`development`, `production`, `default`)

---

## Error Messages

When validation fails, you get clear error messages:

```
❌ Invalid .env syntax at /path/to/.env

  Line 23: Missing '=' separator (expected format: KEY=value)
    > CLAUDE.md

  Line 45: No spaces allowed around "=" (use KEY=value, not KEY = value)
    > MY_KEY = my_value

Fix these errors and try again.
```

---

## Integration with CI/CD

Add validation to your CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Validate env template
  run: npm run validate:env -- .env.example
```

This ensures your `.env.example` template stays valid.

---

## Portability

This tools pack is **project-agnostic**. To use in another Node project:

1. Copy `tools/env/` directory
2. Install dependencies: `dotenv`, `tsx` (dev)
3. Update `package.json` scripts
4. Replace `dotenvConfig()` with `loadValidatedEnv()`

No other changes needed.

---

## Testing

Unit tests cover all validation rules:

```bash
npm test -- tests/unit/env-validator.test.ts
```

Test cases:
- Valid formats (comments, quotes, inline comments)
- Invalid formats (missing =, spaces, lowercase keys)
- Edge cases (empty file, empty lines, special characters)
- Error message formatting

---

## FAQ

**Q: Will this break my existing .env files?**
A: Only if they have invalid syntax. Valid `.env` files work unchanged.

**Q: What about .env.local or .env.test?**
A: Auto-detection checks `.env`, `.env.development`, `.env.production`. Use `envFile` option for custom files.

**Q: Can I use quotes in values?**
A: Yes. Both `KEY="value"` and `KEY=value` are valid.

**Q: What about multiline values?**
A: Use quotes and `\n`: `KEY="line1\nline2"`. Dotenv handles parsing.

**Q: Does this work with Docker?**
A: Yes. Docker can mount `.env` files. Validation runs before container starts.

---

## License

Part of private-price-bot. MIT License.
