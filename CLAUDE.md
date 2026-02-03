# CLAUDE.md — BINDING EXECUTION CONTRACT

This file governs ALL AI agent behavior in this repository.
These are not guidelines. These are hard constraints.
Violation = immediate STOP + report to user.

---

## PROJECT IDENTITY

**Name:** Private Price Bot
**Type:** Privacy-first Telegram bot for cryptocurrency price tracking
**Framework:** grammY (TypeScript) + SQLite
**Repository:** SignalArrayLabs/private-price-bot

**Core Principle:** The bot requires NO admin permissions and does NOT read general messages. It only responds to explicit `/commands` or `@BotName` mentions.

**Features:**
- Price lookup (`/p`, `/price`, `/chart`)
- Price alerts (`/alert add|list|remove`)
- Token calls and leaderboard (`/call`, `/calls`, `/lb`)
- Security scanning (`/scan`, `/deployer`, `/websitecheck`)
- Group configuration (`/setdefault`, `/watch`)

**Architecture:**
```
src/
├── bot/commands/     # 6 command handlers (general, price, config, alerts, calls, security)
├── bot/middleware/   # privacy, rateLimit, mention
├── bot/handlers/     # callback handlers
├── providers/        # price (coingecko, coincap, binance, dexscreener) + security
├── services/         # scheduler, alerts, leaderboard
├── db/               # SQLite schema, migrations
└── utils/            # logger, format, validation
```

**Test Location:** `tests/` (Vitest + MSW mocks)

---

## SECTION 1: ABSOLUTE PROHIBITIONS

### 1.1 BRANCH OPERATIONS
- **FORBIDDEN:** Switching branches without explicit user instruction.
- **FORBIDDEN:** Creating branches outside the assigned branch pattern.
- **FORBIDDEN:** Pushing to `main` directly.
- **FORBIDDEN:** Merging without explicit user approval.

### 1.2 SCOPE MANIPULATION
- **FORBIDDEN:** Reducing scope to mask poor performance.
- **FORBIDDEN:** Silently skipping features that were requested.
- **FORBIDDEN:** Adding unrequested features ("helpful additions").
- **FORBIDDEN:** Refactoring code not directly related to the task.
- **FORBIDDEN:** "Improving" code style outside the change scope.

### 1.3 FALSE COMPLETION CLAIMS
- **FORBIDDEN:** Claiming "tests pass" without showing raw output.
- **FORBIDDEN:** Claiming "fixed" without demonstrating the fix works.
- **FORBIDDEN:** Claiming "done" when handler-level behavior is untested.
- **FORBIDDEN:** Marking tasks complete when errors exist in output.

### 1.4 WORKING TREE VIOLATIONS
- **FORBIDDEN:** Continuing work with uncommitted changes from a prior task.
- **FORBIDDEN:** Staging unrelated files.
- **FORBIDDEN:** Committing with a dirty working tree containing untracked files in `src/` or `tests/`.

### 1.5 CONTEXT MANIPULATION
- **FORBIDDEN:** Reading file contents without first listing the directory.
- **FORBIDDEN:** Assuming file contents from memory of prior sessions.
- **FORBIDDEN:** Guessing function signatures or types.

---

## SECTION 2: MANDATORY BEHAVIORS

### 2.1 BEFORE ANY CODE CHANGE
1. Run `git status` — if dirty with prior work, STOP and report.
2. Run `git branch` — confirm you are on the assigned branch.
3. List the target directory before reading files.
4. Read the file(s) you intend to modify.
5. State the EXACT changes you will make, line by line if needed.
6. Wait for user confirmation OR proceed only if task is unambiguous.

### 2.2 AFTER ANY CODE CHANGE
1. Run `npm run build` — show raw output.
2. Run `npm test` — show raw output.
3. If either fails, STOP. Do not commit. Report the failure.
4. Run `git diff` — show what changed.
5. Commit with a descriptive message.
6. Push to the assigned branch.

### 2.3 TESTING REQUIREMENTS
- **Module tests are necessary but NOT sufficient.**
- Every user-facing change MUST have a handler-level verification:
  - Either an integration test that exercises the command handler.
  - Or manual test steps documented in the commit message.
- If a test passes but the handler output is wrong, the task is NOT complete.

### 2.4 STOP CONDITIONS
You MUST stop and wait for user input when:
- You are uncertain which of multiple approaches to take.
- The task description is ambiguous.
- A required file does not exist.
- A build or test fails.
- You discover the scope is larger than initially described.
- You would need to modify more than 3 files to complete the task.
- You encounter rate limits or API errors.
- The working tree is dirty with unrelated changes.

When stopped, report:
```
STOPPED: [reason]
STATE: [current state of work]
OPTIONS: [what user can decide]
```

---

## SECTION 3: REPORTING FORMAT

### 3.1 TASK START
```
TASK: [one-line description]
BRANCH: [current branch]
FILES TO MODIFY: [list]
APPROACH: [brief description]
```

### 3.2 TASK PROGRESS
```
STEP N: [what was done]
RESULT: [pass/fail + evidence]
```

### 3.3 TASK COMPLETION
```
COMPLETE: [task description]
CHANGES:
- [file]: [what changed]
BUILD: [pass/fail]
TESTS: [pass/fail, count]
COMMIT: [hash]
PUSHED: [branch]
```

### 3.4 TASK FAILURE
```
FAILED: [task description]
REASON: [what went wrong]
STATE: [what was done before failure]
RECOVERY: [suggested next steps]
```

---

## SECTION 4: FILE OPERATION PROTOCOL

### 4.1 READING FILES
1. First: `ls` or `Glob` the directory.
2. Then: Read specific files by path.
3. Never assume a file exists or has specific contents.

### 4.2 EDITING FILES
1. Must have read the file in this session.
2. Use precise edits, not full rewrites (unless creating new file).
3. Preserve existing style and formatting.
4. Do not add comments, docstrings, or type annotations outside the change scope.

### 4.3 CREATING FILES
1. Only create files explicitly requested.
2. Never create documentation files unless explicitly requested.
3. New test files require user approval.

---

## SECTION 5: COMMAND REFERENCE

```bash
# Build
npm run build

# Test
npm test
npm run test:watch

# Lint
npm run lint
npm run lint:fix

# Type check
npm run typecheck

# Run locally
npm run dev

# Database
npm run db:migrate
```

---

## SECTION 6: KEY INVARIANTS

These must ALWAYS be true. If violated, STOP.

1. **Privacy middleware** rejects non-command messages — never bypassed.
2. **No message body storage** — database stores only metadata.
3. **Rate limits** enforced at middleware level — never bypassed.
4. **Provider fallback chain** is: CoinGecko → CoinCap → Binance → DexScreener.
5. **Cache TTL** is respected — no stale data served beyond TTL.
6. **All user-facing output** uses MarkdownV2 escaping via `utils/format.ts`.

---

## SECTION 7: DEFINITION OF DONE

A task is complete when ALL of the following are true:
- [ ] Code compiles (`npm run build` passes)
- [ ] All tests pass (`npm test` passes)
- [ ] Handler-level behavior verified (integration test or documented manual test)
- [ ] Changes committed with descriptive message
- [ ] Pushed to assigned branch
- [ ] No regressions in existing functionality
- [ ] User can reproduce the fix/feature in the live bot

If any checkbox is false, the task is NOT complete.

---

## SECTION 8: HIERARCHY OF AUTHORITY

1. **User instructions** (highest) — explicit commands from the human.
2. **This file (CLAUDE.md)** — binding execution rules.
3. **PLANNING.md** — architecture and design decisions.
4. **Existing code patterns** — follow established conventions.
5. **General best practices** (lowest) — only when above are silent.

If conflict exists, higher authority wins. If unclear, STOP and ask.

---

## ENFORCEMENT

This contract is self-enforcing. Before ANY action, check:
- Does this violate Section 1 (Prohibitions)?
- Does this satisfy Section 2 (Mandatory Behaviors)?
- Am I in a STOP condition (Section 2.4)?

If you find yourself about to violate this contract "to be helpful" or "to save time" — that is exactly when you must NOT do it.

The user has explicitly stated: compliance over convenience.

---

*Last updated: 2026-02-03*
*This file is the binding authority for AI agent behavior in this repository.*
