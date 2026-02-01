#!/bin/bash
# Session End Script - Merge feature branch to main
#
# Purpose: Ensures all work from feature branches is merged to main
#          before session ends, preventing branch drift
#
# Usage: bash scripts/session-end.sh
#
# This script MUST be run at the end of every Claude Code session

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 SESSION END: Merging to main..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

# Verify we're on a claude/* branch
if [[ ! $CURRENT_BRANCH == claude/* ]]; then
    echo "❌ ERROR: Not on a claude/* feature branch"
    echo "   Current branch: $CURRENT_BRANCH"
    echo "   This script should only be run from feature branches"
    exit 1
fi

echo "✅ On feature branch: $CURRENT_BRANCH"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Uncommitted changes detected"
    echo "📝 Committing all changes..."
    git add -A
    git commit -m "chore: final session commit before merge

https://claude.ai/code/session_$(echo $CURRENT_BRANCH | grep -oP '(?<=-)[^-]+$')" || echo "   Nothing to commit"
    echo ""
else
    echo "✅ Working tree clean (no uncommitted changes)"
    echo ""
fi

# Check if main exists locally
if git show-ref --verify --quiet refs/heads/main; then
    echo "✅ Main branch exists locally"
    MAIN_EXISTS=true
else
    echo "⚠️  Main branch does not exist locally"
    echo "   Creating main from current branch..."
    MAIN_EXISTS=false
fi
echo ""

# Switch to main (or create it)
if [ "$MAIN_EXISTS" = true ]; then
    echo "🔀 Switching to main..."
    git checkout main

    # Pull latest main (in case of remote changes)
    echo "⬇️  Pulling latest main from remote..."
    if git pull origin main 2>/dev/null; then
        echo "✅ Main updated from remote"
    else
        echo "⚠️  Could not pull from remote (main may not exist remotely yet)"
    fi
else
    echo "🌱 Creating main branch from current state..."
    git checkout -b main
fi
echo ""

# Merge feature branch to main
echo "🔗 Merging $CURRENT_BRANCH into main..."
if git merge --no-ff $CURRENT_BRANCH -m "feat: merge $CURRENT_BRANCH into main

This merge preserves all work from the feature branch and prevents branch drift.

https://claude.ai/code/session_$(echo $CURRENT_BRANCH | grep -oP '(?<=-)[^-]+$')"; then
    echo "✅ Merge successful"
else
    echo "❌ ERROR: Merge failed"
    echo "   Please resolve conflicts manually"
    exit 1
fi
echo ""

# Note: Cannot push main directly (403 restriction)
echo "⚠️  IMPORTANT: Cannot push main directly (Claude Code 403 restriction)"
echo "   Main branch updated locally only"
echo "   Remote main will be created by GitHub Actions when you push feature branch"
echo ""

# Delete feature branch locally
echo "🗑️  Deleting local feature branch: $CURRENT_BRANCH"
git branch -D $CURRENT_BRANCH
echo "✅ Local feature branch deleted"
echo ""

# Note about remote deletion
echo "📝 NOTE: Remote feature branch will be deleted by GitHub Actions"
echo "   after it merges to main"
echo ""

# Verify final state
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SESSION END COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Current state:"
echo "  Branch: $(git branch --show-current)"
echo "  Recent commits:"
git log --oneline -3 | sed 's/^/    /'
echo ""
echo "Local branches:"
git branch | sed 's/^/  /'
echo ""
echo "⚠️  IMPORTANT FOR NEXT SESSION:"
echo "   1. Always start from 'main' branch"
echo "   2. Create new claude/* branch from main"
echo "   3. Never reuse old feature branches"
echo ""
