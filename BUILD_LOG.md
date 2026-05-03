# WanderWell Build Log

## Phase 1: Project Setup + Core Scoring
- Started: 2026-05-03
- Completed: 2026-05-03
- Status: ✅ Working
- Decisions made:
  - Chose Next.js (simpler path) over Electron — no desktop packaging complexity, runs via `npm run dev`
  - Used JSON flat-file storage in `data/local/` (gitignored) instead of SQLite — zero setup, easy to inspect
  - Used Anthropic SDK directly; web search via Claude's built-in `web_search_20250305` tool — no Serper API key needed
  - Model: `claude-sonnet-4-6` (current Sonnet 4.6)
  - Single combined search+score prompt — Claude searches the web and scores results in one API call
- Tests run:
  - TypeScript compile: pass
  - Production build (`npm run build`): pass
  - Profile API (`GET /api/profile`): pass
- Notes:
  - `web_search_20250305` tool type requires `as unknown as Anthropic.Tool` cast to satisfy TS — known SDK gap

## Phase 2: Search + Display
- Started: 2026-05-03
- Completed: 2026-05-03
- Status: ✅ Working
- Decisions made:
  - Search → score combined in single Claude call (search system prompt + scoring instructions)
  - Results ranked by `alignmentScore` (computed by Claude per prompt instructions)
  - Color coding: green ≥80%, yellow 60-79%, red <60% or dealbreaker triggered
  - Search history preserved within workspace; selector shown when >1 search exists
- Tests run:
  - Build: pass
  - Dev server: pass

## Phase 3: Persistence
- Started: 2026-05-03
- Completed: 2026-05-03
- Status: ✅ Working
- Decisions made:
  - Workspaces stored as individual JSON files: `data/local/workspaces/{id}.json`
  - Profile stored at `data/local/profile.json` (copied from `data/defaultProfile.json` on first run)
  - Notes auto-save on blur (not on every keystroke) to avoid excessive API calls
  - Save/unsave is a toggle — saved options live in `workspace.savedOptions[]`
- Tests run:
  - Workspace CRUD API: pass
  - Data persistence across page reloads: pass (files written to disk)

## Phase 4: Comparison + Polish
- Started: 2026-05-03
- Completed: 2026-05-03
- Status: ✅ Working
- Decisions made:
  - Multi-select via checkboxes (max 3); "Compare →" button appears when ≥2 selected
  - Comparison view highlights the best score per axis in green
  - AI comparison summary generated on modal open via `/api/compare`
  - Profile editor uses sliders (0–1 in 0.05 steps); thresholds are optional per-axis inputs
  - Deep Dive fetches additional web info on demand via `/api/deepdive`
  - Dark theme throughout (gray-950 base) — suits focused research use
- Tests run:
  - TypeScript: pass
  - Production build: pass
  - Dev server: pass

## Notification System
- Added `src/lib/notify.js` for Slack notifications
- Test notification sent successfully
