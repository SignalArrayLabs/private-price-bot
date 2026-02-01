# Deployment Checklist - Sync Dev and Production

**Date:** 2026-02-01
**Issue:** Main branch doesn't exist remotely yet; Dev and Production not synced

---

## Current Status

```
✅ Local Dev: Up-to-date (13 commits on claude/diagnose-branch-drift-tl6FB)
✅ Remote GitHub: Feature branch pushed
❌ Remote GitHub: main branch DOES NOT EXIST
❌ Production (Hetzner): Cannot sync (no main to pull from)
```

---

## Option 1: Wait for GitHub Actions (Recommended)

### Step 1: Check GitHub Actions Status

1. Visit: `https://github.com/SignalArrayLabs/private-price-bot/actions`
2. Look for workflow: "Sync feature branches to main"
3. Check status:
   - ✅ **Running**: Wait for completion (usually <2 minutes)
   - ⏸️ **Waiting for approval**: Click "Approve and run" (first-time workflows need approval)
   - ❌ **Failed**: Check error logs, may need manual fix (see Option 2)
   - ❓ **No workflow listed**: Workflow didn't trigger (see Option 2)

### Step 2: Verify Main Exists

After workflow completes:

```bash
# From your Mac (outside Claude Code)
cd /path/to/private-price-bot
git fetch origin
git branch -r | grep main
# Should show: origin/main
```

### Step 3: Deploy to Production

Once `origin/main` exists:

```bash
# SSH to Hetzner production server
ssh user@your-hetzner-server

# Navigate to bot directory
cd /path/to/private-price-bot

# Fetch latest changes
git fetch origin

# Checkout main (first time)
git checkout -b main origin/main

# Or if main already exists locally
git checkout main
git pull origin main

# Restart bot
pm2 restart private-price-bot

# Verify bot is running
pm2 status
pm2 logs private-price-bot --lines 20
```

---

## Option 2: Manual Fix (If GitHub Actions Didn't Trigger)

### Step 1: Create Main Branch Manually

**On your Mac (NOT in Claude Code session):**

```bash
cd /path/to/private-price-bot

# Fetch latest
git fetch origin

# Create main from the feature branch
git checkout -b main origin/claude/diagnose-branch-drift-tl6FB

# Push main to remote (this works outside Claude Code)
git push -u origin main

# Verify
git branch -a | grep main
# Should show both local and remote main
```

### Step 2: Set Default Branch on GitHub

1. Go to: `https://github.com/SignalArrayLabs/private-price-bot/settings/branches`
2. Change default branch to `main`
3. Save changes

### Step 3: Deploy to Production

Same as Option 1, Step 3 above.

---

## Option 3: GitHub Web UI (No Command Line)

### Step 1: Create Main via Web UI

1. Go to: `https://github.com/SignalArrayLabs/private-price-bot`
2. Click branch dropdown (currently shows `claude/diagnose-branch-drift-tl6FB`)
3. Type `main` in the "Find or create branch" field
4. Click "Create branch: main from claude/diagnose-branch-drift-tl6FB"

### Step 2: Set as Default

1. Go to Settings → Branches
2. Change default branch to `main`

### Step 3: Deploy to Production

Same as Option 1, Step 3 above.

---

## Verification After Deployment

Run these checks to confirm everything is synced:

### On Local Dev

```bash
git fetch origin
git branch -a
# Should show:
# - Local: main, claude/diagnose-branch-drift-tl6FB (or just main if cleaned up)
# - Remote: origin/main
```

### On Production Server

```bash
ssh user@hetzner
cd /path/to/private-price-bot
git branch --show-current  # Should show: main
git log --oneline -3       # Should match local dev
pm2 status                 # Should show: online
```

### Final Checklist

- [ ] Remote `origin/main` exists on GitHub
- [ ] Default branch on GitHub is set to `main`
- [ ] Production server has pulled latest `main`
- [ ] Bot is running on production (`pm2 status`)
- [ ] Bot responds to commands in Telegram
- [ ] Logs show no errors (`pm2 logs private-price-bot`)

---

## Troubleshooting

### GitHub Actions Failed

**Check the logs:**
1. Go to Actions tab
2. Click the failed workflow run
3. Expand the failed step
4. Look for error message

**Common issues:**
- Permissions issue: Repository settings → Actions → General → Workflow permissions → Set to "Read and write"
- Branch protection: Settings → Branches → Remove protection from `main` temporarily

### Can't Push to Main (403 Error)

**This is normal in Claude Code sessions!** Use Option 2 or Option 3 to create main manually.

### Production Won't Pull

**Check these:**
1. Does `origin/main` exist? (`git ls-remote --heads origin main`)
2. Is production configured to correct remote? (`git remote -v`)
3. Are there permission issues? (`ls -la .git/`)
4. Network connectivity? (`ping github.com`)

---

## Summary Commands (Quick Reference)

```bash
# CHECK: Does main exist remotely?
git ls-remote --heads origin main

# CREATE: Main branch manually (outside Claude Code)
git checkout -b main origin/claude/diagnose-branch-drift-tl6FB
git push -u origin main

# DEPLOY: To production
ssh hetzner-server
cd /path/to/private-price-bot
git fetch origin && git checkout main && git pull origin main
pm2 restart private-price-bot
```

---

## When Complete

After successful deployment, your repository state will be:

```
✅ Local Dev: Synced with main
✅ Remote GitHub: main exists and is default
✅ Production: Running latest code from main
✅ All environments: Identical codebase
```

**Document in CHANGELOG.md:**
```markdown
## [Unreleased]
### Deployed
- [2026-02-01] Production deployed from main branch (first time)
```

---

**Next Steps:**
All future development will use the automated workflow, so this manual process is only needed once.
