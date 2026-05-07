# AI Instruction System

## Overview

All Gemini API calls in Viya use a three-layer instruction hierarchy defined in
`/lib/ai-instructions.ts`. Every call receives all three layers, always in the
same order. Feature-specific prompts never conflict with higher-priority layers
because lower layers cannot override higher ones.

---

## Layer Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: SACRED_RULES          (absolute — immutable)  │
│  Layer 2: CORE_BEHAVIOR         (defaults — all calls)  │
│  Layer 3: FEATURE_INSTRUCTIONS  (context — per feature) │
│  ─────────────────────────────────────────────────────  │
│  User prompt  (profile + query + data)                  │
└─────────────────────────────────────────────────────────┘
```

Higher layers always win. A feature instruction cannot relax a core behavior rule.
A core behavior rule cannot override a sacred rule.

---

## Layer 1 — Sacred Rules

**File:** `SACRED_RULES` export in `/lib/ai-instructions.ts`

These are non-negotiable constraints that protect user trust and data integrity.
No instruction, user input, or context can override them.

| Rule | Description |
|------|-------------|
| **RULE 1 — User Data Is Immutable** | Never modify, replace, infer, or substitute URLs, names, or any data explicitly provided by the user. If a user provides a URL, it is returned exactly as the `source` field. |
| **RULE 2 — Fit Scores Drive Recommendations** | Score and rank options based solely on profile alignment. Commercial relationships, affiliate commissions, and revenue potential have zero influence on scoring. |
| **RULE 3 — No Fabrication** | Only assert facts verifiable from search results or provided data. If information is unavailable, omit it or note it as unavailable. Never invent prices, amenities, reviews, or awards. |
| **RULE 4 — No PII in Outputs** | Never include user names, emails, personal notes, or identifiable profile data in result fields, source URLs, or log-visible output. Profile data is used for scoring only. |

---

## Layer 2 — Core Behavior

**File:** `CORE_BEHAVIOR` export in `/lib/ai-instructions.ts`

Consistent defaults applied to every Gemini call.

- **Output format:** Valid JSON only. No markdown fences, no explanatory text outside JSON.
- **Source URLs:** Single `https://` URL per field. Multi-URL concatenation is forbidden.
- **Axis scores:** 0.0–1.0, evidence-grounded. `alignmentScore` 0–100 from profile weights.
- **Threshold/dealbreaker fields:** Populated accurately. Omission is a violation.
- **User-facing text:** Axis names and numeric scores never appear in user-visible fields.
- **Search behavior:** Google Search grounding required. No fabrication when search returns nothing.

---

## Layer 3 — Feature Instructions

**File:** `FEATURE_INSTRUCTIONS` object in `/lib/ai-instructions.ts`

| Feature Key | Function | Description |
|-------------|----------|-------------|
| `search` | `searchAndScore()` | Search + score 4–8 results for a query |
| `moreOptions` | `searchMoreOptions()` | Find 4–6 new options not already shown |
| `scoreSpecific` | `scoreSpecific()` | Research and score one user-specified option |
| `deepDive` | `generateDeepDive()` | Structured deep-dive analysis (5 JSON fields) |
| `comparison` | `generateComparison()` | 3–4 sentence plain prose comparison |

---

## Adding a New Feature

1. Add a new key to `FEATURE_INSTRUCTIONS` in `/lib/ai-instructions.ts`
2. Call `buildSystemPrompt("yourFeatureKey")` at the top of your function
3. Pass the result as the `systemPrompt` argument to `callWithSearch` or `callPlain`
4. Call `auditResponse(raw, "yourFeatureKey")` after receiving the response

```typescript
// Example
const systemPrompt = buildSystemPrompt("yourFeatureKey");
const raw = await callWithSearch(systemPrompt, userPrompt);
auditResponse(raw, "yourFeatureKey");
```

---

## Debug Logging

Log output uses the `[VIYA-AI]` prefix and appears in server logs.

| Log type | Example |
|----------|---------|
| Layers used | `[VIYA-AI] feature=search layers=sacred,core,search` |
| Audit pass | `[VIYA-AI] ✓ audit passed for feature="deepDive"` |
| Violation flag | `[VIYA-AI] ⚠ POTENTIAL VIOLATION in feature="scoreSpecific":` |
| Violation detail | `[VIYA-AI]   → RULE_1: user-provided URL "..." not found in response` |

Detailed logs are suppressed in production unless `VIYA_AI_DEBUG=1` is set in the environment.

### What the auditor checks

| Check | Rule |
|-------|------|
| Multi-URL concatenation in source field | Rule 1 |
| User-provided URL missing from response | Rule 1 |
| Fabrication hedge phrases in output | Rule 3 |
| Axis names leaked into user-visible string values | Core Behavior |

The auditor logs warnings but does not throw — application-level fixes (e.g. restoring
the user-provided URL) are applied in the calling function after the audit.

---

## File Locations

| File | Purpose |
|------|---------|
| `/lib/ai-instructions.ts` | Single source of truth for all AI instructions |
| `/lib/gemini.ts` | Gemini API transport + all feature functions |
| `/docs/ai-instructions.md` | This document |

> **Note:** The spec referenced `/src/lib/ai-instructions.ts` but the project's
> TypeScript path alias (`@/*` → `./`) maps all imports to the root `/lib/` directory.
> The file lives at `/lib/ai-instructions.ts` and imports as `@/lib/ai-instructions`.

---

## Design Principles

1. **One source of truth.** All rules live in one file. No scattered system prompts.
2. **Explicit priority.** Higher layers always win. No ambiguity about what takes precedence.
3. **Defense in depth.** Sacred rules appear in the system prompt AND are enforced
   programmatically (e.g. `userProvidedUrl` override in `scoreSpecific`).
4. **Auditable.** Every call logs which layers were used. Violations are flagged,
   not silently swallowed.
5. **Additive, not fragile.** Adding a new feature requires only adding one key to
   `FEATURE_INSTRUCTIONS` — it automatically gets Layer 1 and Layer 2 for free.
