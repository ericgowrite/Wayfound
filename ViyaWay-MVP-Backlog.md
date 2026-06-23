# ViyaWay — MVP Product & UX Backlog
**Date:** 2026-06-22
**Scope:** Product experience and value first. Monetization deliberately deferred — see bottom of doc.

Each item: **Problem → Decision → Approach → Done criteria.** This format exists so a future agent (or Eric) can tell when an item is actually finished, not just "improved."

**Standing cross-cutting requirement:** Mobile web experience currently does not translate well from desktop — this is a known gap, not a future nice-to-have. Every UI item below must be verified on mobile viewport widths (not just described as responsive) before being considered done. This applies most directly to #3 but is a bar for all UI work going forward.

---

## Phase 1 — MVP (this build cycle)

**Build order (updated 2026-06-22):** #3 (responsive layout) moved ahead of #4 (link accuracy) — mobile experience flagged twice by Eric as the most visible problem, and a confirmed technical contributor (missing `viewport` export in `app/layout.tsx`) has already been fixed. Order is now: #3 → #2 → #1 → #4.

**Status:** All four Phase 1 MVP items (#3, #2, #1, #4) are implemented. Also fixed along the way: a real crash on first-run profile creation (unrelated to mobile work, found while testing), and trip destination is now passed as default search context so users don't have to retype the location in every query.

### 1. Personal Feedback & Memory System
**Problem:** No mechanism exists for a user to record low-energy, structured feedback on a property after experiencing it (e.g. "close to busy road, breaks the sense of seclusion"). Feedback today is purely implicit (save/reject), with no qualitative layer and no persistence beyond the current calibration math in `lib/calibration.ts`.

**Decision:**
- Scope: **personal only** for this phase. Feedback informs the submitting user's own future searches and notes. Shared/aggregated feedback across users is deferred to Phase 2 (see #6) — it requires solving property identity first, which isn't worth blocking this on.
- Format: feedback is **structured data in Firestore** (consistent with how profiles/workspaces already work), rendered back to the user as human-readable notes. No literal `.md` file — Cloud Run has no persistent disk, and there's no portability requirement right now. The "notes" feel is a presentation layer, not a storage format.
- Trigger: feedback is prompted **after the trip** (most accurate signal — they've actually experienced it), not at save/reject time (which is just a prediction).
- Channel: **in-app prompt only** for MVP. No email/notification infrastructure. Trade-off: lower response rate, but zero new dependencies.

**Approach:**
- Add a `feedback` subcollection or array field per saved option (axis-tagged checkboxes + optional free-text note).
- Checkbox set should map to the 7 existing axes (`calm`, `designSincerity`, `valueIntegrity`, `socialPermeability`, `autonomy`, `novelty`, `locationFriction`) so feedback is structurally comparable to `axisScores` already on `ScoredOption`.
- Also capture a simple "did it meet expectations?" signal (separate from axis-specific feedback) — this is the piece that lets us measure whether `alignmentScore` predictions are actually accurate over time. Treat this as a product-metrics opportunity, not just a UX feature: it's the first real signal connecting "we said 87% fit" to "did it actually fit."
- Requires the new "Booked/Going" status from item #2 to know *when* to prompt (see below).

**Done criteria:** A user can mark a saved option as "Booked/Going," and once the trip's end date passes, an in-app prompt appears offering quick axis-checkbox feedback + a free-text note. That feedback is stored per-user, per-property, and visible later in the Saved tab as readable notes.

---

### 2. Wire Up "Booked" Status to the Feedback Trigger
**Problem:** Eric raised "where do saved and interested go" — originally scoped here as adding a new status. **Correction during implementation:** `ScoredOption.status` already includes `"interested"` and `"booked"` as first-class values (`new` / `interested` / `rejected` / `booked`), with buttons for all three already wired up in `ResultCard.tsx`. There's no missing status to add. The actual gap is narrower: marking something "booked" doesn't currently *do* anything — it's not tied to trip dates, and nothing checks for "this trip has passed, prompt for feedback."

**Decision:** No new status field needed. Build the missing piece only: a date-check that promotes a booked option into "eligible for post-trip feedback" once its workspace's trip dates have passed.

**Approach:** `handleStatusChange` in `WorkspaceView.tsx` already persists the `booked` status — extend it (or add a derived check) comparing `workspace.dates` end against today's date for any option with `status === "booked"`. No schema change required, just the trigger logic that #1 depends on.

**Done criteria:** A booked option whose trip dates have passed is identifiable by the app (e.g. a computed `isFeedbackEligible` check) without any new field, and that's what #1's prompt logic reads.

---

### 3. Results Layout — Responsive Grid
**Problem:** Results render as a single-column vertical list regardless of screen width or result count, which doesn't scale well as result counts grow.

**Decision:** Grid layout on desktop (multi-column, less scrolling, see more at a glance), collapsing to today's single-column list on mobile/narrow viewports. Pure responsive CSS — no new data requirements. (Map view considered and explicitly deferred — would need lat/long data not currently stored, bigger lift, revisit if/when Places API integration happens.)

**Approach:** Update `WorkspaceView.tsx` results rendering (`sortedResults.map(...)` block) to use a responsive grid (e.g. Tailwind `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) instead of `space-y-3` vertical stacking. `ResultCard` may need layout adjustments to work well in a narrower grid cell vs. full-width row.

**Done criteria:** Results display in a multi-column grid at desktop widths and collapse cleanly to single-column on mobile, with no loss of functionality (save, compare, status change, notes all still work per-card).

---

### 4. Link Accuracy — Grounding Citations + Server-Side Validation
**Problem:** Source links are "not always correct." Root cause: the AI has to *transcribe* a URL from memory into a JSON field, rather than the app using the actual citation URL that Gemini's search-grounding tool already returns as structured metadata. Validation also currently happens lazily, client-side, after the fact — meaning bad links can already be visible to users before/if they're ever checked.

**Decision:** Fix this now, in two parts, with no new dependency (this is explicitly *not* waiting for Phase 2 Places integration):
1. **Use grounding citation metadata** from the Gemini response (`groundingMetadata` / citation chunks) as the authoritative source URL where available, instead of trusting only what the model wrote into the JSON `source` field.
2. **Move validation server-side and synchronous** — validate the URL *before* a search result is persisted/returned, not lazily on the client per-render. If a result fails validation, fall back to a guaranteed-working Google Maps search link for that property name + location rather than showing a dead/wrong link.

**Approach:**
- In `lib/gemini.ts`, inspect `result.response.candidates[0].groundingMetadata` (or equivalent field per current SDK version) for citation URLs; cross-reference against the model's `source` field; prefer the citation URL when there's a confident match.
- In `app/api/search/route.ts` / `score/route.ts`, call the existing `checkUrl`-equivalent logic server-side on each result before returning it, replacing failed URLs with a Maps fallback link (`https://www.google.com/maps/search/?api=1&query=<encoded property name + destination>`).

**Done criteria:** No search result is ever returned to the client with a known-broken source link — it either has a validated real link or a Maps fallback. Citation-sourced URLs are used preferentially over model-transcribed ones.

---

## Phase 2 — Next (gated on a Google Places API decision)

### 5. Google Places Integration — Images + Property Identity
**Problem:** Three separate asks all point to the same root fix: (a) no images, currently relying on outbound links; (b) no stable property identity, so shared/community feedback (#6) can't work; (c) link accuracy would improve further with a canonical "website" field instead of an AI-transcribed guess.

**Decision:** Pursue Google Places API as the shared solution to all three — but explicitly flagged as a lift to evaluate before committing; skip if too costly/complex for true MVP rather than let it block shipping. Eric's framing: "create a great experience that provides as much info as possible" — Places API serves that goal directly (real photos, real identity, real official links) if the integration cost is acceptable.

**Approach:** Evaluate Google Places API pricing/quota against expected search volume before committing. If approved: use Place ID as the canonical property identity (unlocks #6), `photos` field for images, `website` field as a more reliable link source than AI transcription (supersedes the interim fix in #4, doesn't replace it — #4 ships first regardless).

**Done criteria:** A go/no-go decision documented with actual cost estimate, followed by either an implementation plan or an explicit "not now" with the reason recorded.

---

### 6. Shared Community Feedback (gated on #5)
**Problem:** Personal feedback (#1) is high value to the individual user but doesn't compound across the user base. Shared feedback tagged by axis-relevance, attached to the property itself, would let one user's "noisy road" note help anyone with similar axis weights searching that property later — a real data moat.

**Decision:** Deferred until property identity (#5) exists — without a stable way to recognize "the same property" across different users' searches, shared feedback has nowhere reliable to attach.

**Approach (once unblocked):** Feedback collection keyed by Place ID rather than per-user; surfaced during scoring/search when a result matches a property with existing community feedback; requires basic moderation/abuse handling since this is now cross-user data.

**Done criteria:** Not started. Revisit once #5 ships.

---

## Flagged for Design Exploration (not resolved yet — needs direct UI review, not a single decision)

### 7. Cross-Trip Workspace Navigation
Eric flagged that navigating across multiple trip workspaces needs improvement, separate from the saved-items-per-trip question (saved options stay per-trip — that part's settled). This needs a direct look at the current dashboard/workspace-switcher UI before proposing a fix, rather than a decision made in the abstract. Tracked as task #5 in the working session.

---

## Parked — Explicitly Not MVP

### 8. Video Content
Vision item. No hosting/upload pipeline exists. Revisit after MVP ships.

### 9. User-Generated Content (UGC)
Vision item. Requires capture + moderation + tagging infrastructure beyond what #1/#6 cover. Revisit after MVP ships — note that #6 (shared feedback) is a lighter-weight, more tractable version of the same underlying idea and may satisfy most of the intent here once it ships.

---

## Deferred — Revisit After Product/UX Phase

### 10. Monetization
Explicitly set aside per Eric's direction: focus on product experience and value first, then revisit monetization. Items captured for later, not forgotten:
- Direct booking mechanism (in-app booking flow)
- Affiliate/bounty model via hotel direct links
- Google booking integration
- Friction reduction in the booking handoff

None of these are scoped or decided — this section is a placeholder for the next planning pass, not a spec.
