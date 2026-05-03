# WanderWell Personal — Build Summary

## What Was Built

A personal travel research app that searches for travel options and scores them against a psychological profile (7-axis fit model). Built for Eric (Type 9w8).

**Stack:** Next.js 16 + React + TypeScript + Tailwind CSS  
**AI:** Anthropic SDK (`claude-sonnet-4-6`) with built-in web search  
**Storage:** JSON flat files in `data/local/` (gitignored, persists locally)

## How to Run

```bash
# 1. Add your Anthropic API key to .env.local
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local

# 2. Start the dev server
npm run dev

# 3. Open http://localhost:3000
```

## Features Built

| Feature | Status |
|---------|--------|
| Profile viewer + editor (sliders, thresholds, dealbreakers) | ✅ |
| Trip workspace CRUD (create, delete, persist) | ✅ |
| Search → Claude web search + psychological scoring | ✅ |
| Results ranked by alignment % with color coding | ✅ |
| Threshold warnings + dealbreaker flags | ✅ |
| Expand cards for axis bars, tradeoffs, notes | ✅ |
| Save/unsave options to workspace | ✅ |
| Status tracking (interested / rejected / booked) | ✅ |
| Multi-select comparison view (2–3 options) | ✅ |
| AI comparison summary | ✅ |
| Deep Dive (additional web research on single option) | ✅ |
| Trip notes | ✅ |
| Full data persistence (close + reopen) | ✅ |

## Success Criteria Check

1. ✅ Open the app and see your profile — sidebar shows Eric / Type 9w8, click to open editor
2. ✅ Create a trip workspace — "+ New Trip" in sidebar
3. ✅ Search for travel options — search bar in workspace with category selector
4. ✅ See results ranked by psychological fit with explanations — alignment %, fit explanation, axis bars
5. ✅ Save interesting options — "Save" button on each result card
6. ✅ Compare 2-3 options side-by-side — checkbox select + "Compare →" button
7. ✅ Add notes to options — notes field in each expanded card
8. ✅ Close and reopen with data persisted — JSON files survive restarts

## Deviations from Spec

- **Framework:** Next.js (local dev server) instead of Electron — simpler setup, same UX for personal use
- **Search:** Used Claude's built-in `web_search` tool instead of Serper API — no extra API key needed
- **Scoring:** Claude computes `alignmentScore` directly rather than a separate client-side calculation — more nuanced, leverages AI judgment
- **No radar chart:** Used horizontal bar charts for axis scores — simpler, cleaner in the card layout

## Known Limitations / TODOs

- `ANTHROPIC_API_KEY` must be set in `.env.local` before first use
- Search takes 15–30 seconds (Claude + web search round-trip) — expected
- No search result caching — same query hits the API each time
- Axis scoring prompt may need tuning based on real results (as noted in spec)
- Phase 5 enhancements (multiple profiles, export, property database) not built — intentionally out of scope for MVP
