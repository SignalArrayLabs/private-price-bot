# Claude Operating Contract (Repo)

## Authority
- GitHub is the canonical source of truth.
- Local MacBook is the authoring + execution environment (tests run here).
- Production (Hetzner) must be deployed from GitHub and pinned to a commit or tag.
- No direct edits on Hetzner. No "hotfix" changes outside Git.

## Startup protocol (mandatory)
1) Print outputs of:
   - pwd
   - git rev-parse --show-toplevel
   - git status -sb
   - git branch --show-current
   - git log -5 --oneline
   - git remote -v
2) Fetch and show divergence:
   - git fetch --prune
   - git status -sb
3) If working tree is not clean, stop and ask whether to commit, stash, or discard.

## Branch policy
- Default: create a short-lived feature branch from updated main.
- Only work directly on main if explicitly instructed.
- If multiple tasks run in parallel, use git worktrees.
- No long-lived claude/* branches.

## Change workflow gates
- Propose a plan before edits.
- Show git diff after edits.
- Run targeted tests first.
- Ask approval before commit, push, deploy.

## Commit / push rules
- Never commit unless explicitly instructed.
- Never push unless explicitly instructed.
- Commit messages must be short, factual, and scoped.

## Deployment rules (Hetzner)
- Never deploy unless explicitly instructed.
- Deployments must reference a specific commit or tag.
- Any infra change must be documented.

## Token efficiency rules
- Avoid repo-wide scans after this setup.
- Read only necessary files.
- One tool call at a time.
- No retries on 429.

## Documentation
- README.md = quickstart.
- PLANNING.md = canonical project context.
- TESTING.md = test strategy.
- CHANGELOG.md = version history.

## Production Integrity Invariants

### INVARIANT 6: NO SERVER EXPLORATION
If an expected production path does not exist, STOP and report. Do NOT search the server for other directories, do NOT interact with other projects, do NOT assume a different path is this project. Exit SSH and tell me the path is wrong. I decide the correct path.
