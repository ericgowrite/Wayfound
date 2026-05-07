# Branching & PR Workflow

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready. Never commit directly. |
| `feat/<topic>` | New features (e.g. `feat/group-search`) |
| `fix/<topic>` | Bug fixes (e.g. `fix/fit-score-mismatch`) |
| `chore/<topic>` | Cleanup, deps, config (e.g. `chore/audit-cleanup`) |

## Starting a feature

```bash
git checkout main && git pull
git checkout -b feat/my-feature
# ... do work ...
git add <files>
git commit -m "feat: describe what changed and why"
git push -u origin feat/my-feature
```

Then open a PR on GitHub targeting `main`.

## Commit message format

```
<type>: <short description>

<optional body — what and why, not how>
```

Types: `feat` · `fix` · `chore` · `docs` · `refactor` · `test`

## PR checklist

Before opening:
- `npx tsc --noEmit` passes with zero errors
- Dev server starts without errors
- Manual smoke test of changed surfaces

The PR template (`.github/pull_request_template.md`) auto-fills when you open a PR on GitHub.
