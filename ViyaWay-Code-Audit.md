# ViyaWay — Code Audit Report
**Date:** 2026-06-21  
**Scope:** Full codebase review targeting 99.999% run-rate reliability  
**Reviewer:** Claude (Cowork)

---

## Summary

The codebase is well-structured overall. The auth isolation fix (moving from `next/headers` to `request.headers` across all 18 API call sites) was the right call and is cleanly implemented. What follows is a tiered list of every issue found, from production-breaking to polish.

---

## 🔴 CRITICAL — Production breaking

### 1. URL validation calls always return 401 in production
**File:** `lib/urlValidation.ts` line 58  
**Problem:** `validateUrl()` calls `/api/validate-url` with plain `fetch` — no Authorization header. The middleware in `middleware.ts` blocks every `/api/*` request without a Bearer token with a 401. This means every URL validity check silently fails, and the client gets `{ valid: false, status: 0, reason: "client_error" }` for every URL.

```ts
// BROKEN — plain fetch, no auth
const res = await fetch("/api/validate-url", { ... });
```

**Fix:** Use `fetchWithAuth` instead:
```ts
import { fetchWithAuth } from "@/lib/fetchWithAuth";
// ...
const res = await fetchWithAuth("/api/validate-url", { method: "POST", ... });
```

---

### 2. Health check / ping route is blocked by middleware
**File:** `app/api/ping/route.ts` and `middleware.ts`  
**Problem:** The middleware applies a Bearer token check to all `/api/:path*` routes, which includes `/api/ping`. GCP Cloud Run health checks (and any external uptime monitors) call `/api/ping` without credentials, so they always get 401. Cloud Run will report the instance unhealthy.

**Fix:** Exclude `/api/ping` and `/api/validate-url` from the middleware matcher:
```ts
export const config = {
  matcher: ["/api/((?!ping|validate-url).*)"],
};
```
Note: `/api/validate-url` can then rely on its own internal-only design, or you can add `getUserId` validation inside the route handler directly.

---

### 3. Crash if `GOOGLE_API_KEY` env var is missing
**File:** `lib/gemini.ts` line 8  
**Problem:** `new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)` — the `!` non-null assertion is TypeScript-only and does nothing at runtime. If `GOOGLE_API_KEY` is unset, `undefined` is passed to the constructor silently. The process won't crash at startup, but every AI call will fail with a confusing auth error from Google's SDK rather than a clear "missing configuration" message.

**Fix:** Add an explicit guard at module load:
```ts
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("[VIYA] GOOGLE_API_KEY environment variable is not set");
const client = new GoogleGenerativeAI(apiKey);
```
This surfaces the problem immediately on startup rather than during user requests.

---

### 4. SSRF exposure in URL validation route
**File:** `app/api/validate-url/route.ts` lines 44–72  
**Problem:** The server-side `checkUrl()` function fetches arbitrary user-provided URLs from the Cloud Run instance's network. Only `https?://` is checked. An attacker with a Firebase account can probe internal GCP metadata endpoints, private subnets, or instance metadata (`169.254.169.254`, `10.x.x.x`, etc.).

**Fix:** Add a blocklist in `checkUrl()` before making the fetch:
```ts
function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)/.test(hostname);
  } catch { return true; }
}

async function checkUrl(url: string): Promise<ValidateResult> {
  if (isPrivateUrl(url)) {
    return { valid: false, finalUrl: null, status: 0, reason: "private_address" };
  }
  // ... rest of implementation
}
```

---

## 🟠 HIGH — Significant reliability risk

### 5. `handleCalibrationAccept` doesn't check for HTTP errors
**File:** `components/WorkspaceView.tsx` lines 258–277  
**Problem:** If the PUT request to `/api/profiles/{id}` fails (network error, 500, 401 token expiry), `res.json()` will parse an error body like `{ error: "..." }` and `onProfileUpdate(saved)` will be called with that error object, silently corrupting the active profile in React state. The UI will then render garbage until the user reloads.

```ts
// MISSING: no res.ok check
const res = await fetchWithAuth(`/api/profiles/${primaryProfile.id}`, { ... });
const saved = await res.json(); // could be { error: "..." }
onProfileUpdate(saved);         // 🔥 corrupts state
```

**Fix:**
```ts
const res = await fetchWithAuth(`/api/profiles/${primaryProfile.id}`, { method: "PUT", ... });
if (!res.ok) {
  console.error("Calibration save failed:", await res.text());
  setPendingCalibration(null);
  return;
}
const saved = await res.json();
onProfileUpdate(saved);
```

---

### 6. Profile save has a read-modify-write race condition
**File:** `lib/storage.ts` lines 40–46  
**Problem:** `saveProfileToList()` reads all profiles, modifies the array in memory, then writes the whole array back as a single Firestore `set()`. If two requests save different profiles within milliseconds of each other (e.g., calibration acceptance + profile editor save), one will overwrite the other's changes.

```ts
export async function saveProfileToList(userId: string, profile: Profile): Promise<void> {
  const profiles = await getProfiles(userId);  // read
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile; else profiles.push(profile);
  await profilesRef(userId).set({ profiles }); // write — not atomic
}
```

**Fix:** Use a Firestore transaction:
```ts
export async function saveProfileToList(userId: string, profile: Profile): Promise<void> {
  const ref = profilesRef(userId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const profiles: Profile[] = snap.exists ? (snap.data()?.profiles ?? []) : [];
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) profiles[idx] = profile; else profiles.push(profile);
    tx.set(ref, { profiles });
  });
}
```

---

### 7. Raw error details leaked to client in workspace routes
**File:** `app/api/workspaces/route.ts` lines 15, 40  
**Problem:** Errors are returned as `String(e)`, which can expose internal Firestore paths, stack traces, or config details to the client. All other routes correctly use `friendlyError(e)`.

```ts
// workspaces/route.ts — inconsistent error handling
return NextResponse.json({ error: String(e) }, { status: 500 }); // leaks internals
```

**Fix:** Replace both instances with `friendlyError(e)` (already imported in many other routes — add it here):
```ts
import { friendlyError } from "@/lib/errorMessages";
// ...
return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
```

---

### 8. No input validation on search/score API routes
**File:** `app/api/search/route.ts`, `app/api/score/route.ts`  
**Problem:** `query`, `category`, and `workspaceId` are pulled from the request body without validation. An empty query string or invalid category silently propagates to Gemini, wasting quota and producing garbage results. A missing `workspaceId` causes `getWorkspace()` to receive `undefined`, returning null, and the 404 branch fires — but the error message is generic.

**Fix:** Add early validation:
```ts
const { workspaceId, query, category } = await request.json();
if (!workspaceId || typeof workspaceId !== "string") {
  return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
}
if (!query?.trim()) {
  return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
}
const validCategories: SearchCategory[] = ["accommodation","tour","restaurant","activity","attraction"];
if (!validCategories.includes(category)) {
  return NextResponse.json({ error: "Invalid category" }, { status: 400 });
}
```

---

### 9. Gemini JSON parsing has no field validation
**File:** `lib/gemini.ts` lines 61–73  
**Problem:** `parseArray()` and `parseObject()` parse Gemini's response and return the result as the full typed object, but no field validation is done. If Gemini omits `name`, `alignmentScore`, or `fitExplanation` (which happens on capacity-degraded responses), these fields are silently `undefined`. The `hydrate()` function handles `thresholdViolations`, `watchOutFor`, `dealbreakersTriggered`, and `tradeoffs` with `?? []`, but not `name`, `description`, `alignmentScore`, or `fitExplanation`.

**Fix:** Add a sanitization step in `hydrate()`:
```ts
function hydrate(item: Omit<ScoredOption, "id" | "searchId" | "status" | "notes">, searchId: string): ScoredOption {
  return {
    name: item.name ?? "Unknown",
    description: item.description ?? "",
    price: item.price ?? "",
    alignmentScore: typeof item.alignmentScore === "number" ? item.alignmentScore : 0,
    fitExplanation: item.fitExplanation ?? "",
    axisScores: item.axisScores ?? { calm: 0.5, designSincerity: 0.5, valueIntegrity: 0.5, socialPermeability: 0.5, autonomy: 0.5, novelty: 0.5, locationFriction: 0.5 },
    id: uuidv4(),
    searchId,
    status: "new" as const,
    notes: "",
    source: sanitizeSourceUrl(item.source),
    thresholdViolations: item.thresholdViolations ?? [],
    watchOutFor: item.watchOutFor ?? [],
    dealbreakersTriggered: item.dealbreakersTriggered ?? [],
    tradeoffs: item.tradeoffs ?? [],
  };
}
```

---

## 🟡 MEDIUM — Bugs and edge cases

### 10. `workspaceNotes` state doesn't sync when workspace prop changes
**File:** `components/WorkspaceView.tsx` line 53  
**Problem:** `const [workspaceNotes, setWorkspaceNotes] = useState(workspace.notes)` — initialized from the prop once. If the parent component updates the workspace (e.g., after a save), `workspaceNotes` won't reflect the new value because `useState` ignores prop changes after initial render.

**Fix:** Add a `useEffect` to sync:
```ts
useEffect(() => {
  setWorkspaceNotes(workspace.notes);
}, [workspace.notes]);
```

---

### 11. `onDeepDive` prop is a no-op everywhere
**File:** `components/WorkspaceView.tsx` lines 627, 694  
**Problem:** `onDeepDive={() => {}}` is passed to every `ResultCard`. If `ResultCard` internally handles deep dive (via its own state), this is harmless. But if it was ever wired to trigger an external modal or parent action, that path is silently broken. Worth confirming the deep dive flow is fully self-contained in `ResultCard`.

---

### 12. System dark mode preference ignored on first visit
**File:** `lib/useTheme.ts`, `app/layout.tsx`  
**Problem:** The inline script in `app/layout.tsx` only checks `localStorage.getItem('theme')`. If a new user has never set a theme, `localStorage` has no value, and the script does nothing — even if their OS is in dark mode. The `useTheme` hook's initial state is also `false` (light). First-time dark mode users see the app in light mode until they manually toggle.

**Fix:** Add a system preference check in the inline script:
```html
<script dangerouslySetInnerHTML={{
  __html: `(function(){
    try {
      var t = localStorage.getItem('theme');
      if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch(e) {}
  })()`
}} />
```
And update `useTheme`'s initial state:
```ts
const [dark, setDark] = useState(false);
useEffect(() => {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setDark(stored === "dark" || (!stored && prefersDark));
}, []);
```

---

### 13. `extractUserUrl` bare domain regex can false-positive on natural language
**File:** `lib/gemini.ts` lines 96–98  
**Problem:** The bare-domain regex `(?:^|\s)((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}...)` will match things like "staying at" followed by a word with a dot in the score input. For example, "The Ritz in Paris, France. Amazing views" could match "France. Amazing" if punctuation splitting fails. The result would be an incorrect URL injection.

**Fix:** Make the regex stricter — require the domain to have at least one word character before the TLD and no trailing punctuation directly after:
```ts
const bareMatch = input.match(/(?:^|\s)((?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,6}(?:\/[^\s,)"]*)?)/);
```
Also avoid matching TLDs that don't look like domains (e.g., skip single-word + `.it/de/fr` when the preceding word is a common English word).

---

### 14. Calibration log grows unboundedly in localStorage
**File:** `lib/calibration.ts` lines 175–181  
**Problem:** `logCalibrationEvent()` appends to the log array with no cap. URL reports are capped at 200, but calibration events are not. Over many sessions, this will silently fill localStorage quota and start failing (silently caught by `try/catch`).

**Fix:**
```ts
export function logCalibrationEvent(event: CalibrationEvent): void {
  try {
    const log = getCalibrationLog();
    log.push(event);
    localStorage.setItem(CAL_LOG_KEY, JSON.stringify(log.slice(-100))); // keep last 100
  } catch {}
}
```

---

### 15. `ping` route hardcodes a stale git SHA
**File:** `app/api/ping/route.ts` line 4  
**Problem:** `build: "a0da453"` is hardcoded and won't update with deployments. Makes it impossible to confirm which build is running.

**Fix:**
```ts
export function GET() {
  return NextResponse.json({
    ok: true,
    build: process.env.K_REVISION ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
    ts: Date.now()
  });
}
```
(`K_REVISION` is the Cloud Run revision name, auto-set by GCP.)

---

### 16. `force-dynamic` missing from authenticated GET routes
**File:** `app/api/profiles/route.ts` and other GET-only routes  
**Problem:** Only `workspaces/route.ts` has `export const dynamic = "force-dynamic"`. GET routes that call `getUserId(request)` are dynamic by nature (they read the Authorization header), and Next.js 15 should detect this. However, explicitly declaring `force-dynamic` prevents any risk of the response being cached and served to the wrong user — especially important on Cloud Run with CDN fronting.

**Fix:** Add to all authenticated API route files:
```ts
export const dynamic = "force-dynamic";
```
Routes to add it to: `app/api/profiles/route.ts`, `app/api/profiles/[id]/route.ts`, `app/api/profile/route.ts`.

---

## 🔵 LOW — Polish and maintainability

### 17. `AuthContext.tsx` — `ensureUserDoc` silently ignores errors
**File:** `lib/AuthContext.tsx` lines 50, 65, 71  
`try { await ensureUserDoc(u); } catch {}` — if the initial Firestore write fails, the user has a valid auth session but no top-level `users/{uid}` document. Subsequent behavior depends on whether that document is ever needed (currently it appears only the subcollections matter). Safe today but worth logging:
```ts
try { await ensureUserDoc(u); } catch (e) { console.error("[AuthContext] ensureUserDoc failed:", e); }
```

---

### 18. `friendlyError` doesn't handle Gemini SDK-specific error shapes
**File:** `lib/errorMessages.ts`  
Gemini SDK errors sometimes wrap in `GoogleGenerativeAIError` objects with codes like `RESOURCE_EXHAUSTED` or `INVALID_ARGUMENT`. These won't match the string-based regex checks and will fall through to the generic "Something unexpected happened" fallback. Add a check:
```ts
if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("resource exhausted")) {
  return "We've hit a temporary rate limit. Please wait a few seconds and try again.";
}
if (msg.includes("INVALID_ARGUMENT") || msg.includes("invalid argument")) {
  return "Your search contains something we couldn't process. Please try rephrasing.";
}
```

---

### 19. `auditResponse` fabrication detection can false-positive
**File:** `lib/ai-instructions.ts` lines 252–265  
Phrases like "I don't have" are checked against the entire raw response. A property description like `"Note: I don't have confirmation of peak season pricing"` would trigger a fabrication warning. Since this is warning-only and not thrown, the false positive is benign — but if the audit gets stricter in future, be aware.

---

### 20. `scoreAssessment` wastes scores[0] slot
**File:** `lib/assessment.ts` line 257  
`new Array(10).fill(0)` allocates index 0–9 for Enneagram types 1–9. Index 0 is permanently unused. Not a bug, but rename or document:
```ts
// Index 0 unused — types are 1-indexed
const scores = new Array(10).fill(0) as number[];
```

---

## Priority Fix Order

| # | Severity | File | Fix time |
|---|----------|------|----------|
| 1 | 🔴 Critical | `lib/urlValidation.ts` — use `fetchWithAuth` | 2 min |
| 2 | 🔴 Critical | `middleware.ts` — exclude `/api/ping` and `/api/validate-url` | 2 min |
| 3 | 🔴 Critical | `lib/gemini.ts` — guard on `GOOGLE_API_KEY` | 2 min |
| 4 | 🔴 Critical | `app/api/validate-url/route.ts` — block private IPs (SSRF) | 15 min |
| 5 | 🟠 High | `components/WorkspaceView.tsx` — check `res.ok` in calibration accept | 5 min |
| 6 | 🟠 High | `lib/storage.ts` — Firestore transaction for profile saves | 15 min |
| 7 | 🟠 High | `app/api/workspaces/route.ts` — use `friendlyError` | 2 min |
| 8 | 🟠 High | `app/api/search/route.ts` + `score/route.ts` — input validation | 10 min |
| 9 | 🟠 High | `lib/gemini.ts` — field validation in `hydrate()` | 10 min |
| 10 | 🟡 Medium | `components/WorkspaceView.tsx` — sync `workspaceNotes` | 2 min |
| 11 | 🟡 Medium | `app/layout.tsx` + `lib/useTheme.ts` — system dark mode | 10 min |
| 12 | 🟡 Medium | `lib/calibration.ts` — cap calibration log | 2 min |
| 13 | 🟡 Medium | `app/api/ping/route.ts` — use `K_REVISION` | 2 min |
| 14 | 🟡 Medium | All auth'd GET routes — `force-dynamic` | 5 min |

**Estimated total fix time:** ~1.5 hours

---

## What's Working Well

- **Auth isolation** — `getUserId(request)` pattern is correctly applied across all 18 call sites. The async context leak is fixed.
- **Retry logic** — Exponential backoff with jitter + model fallback in `withRetry()` is solid.
- **Sacred rules + audit system** — `buildSystemPrompt` + `auditResponse` is a clean, extensible pattern for prompt governance.
- **Scoring model** — `calculateAlignmentScore`, `combineProfiles`, and `sortByGroupFit` are well-reasoned and handle edge cases (thresholds, dealbreakers, group vs. solo).
- **URL sanitization** — `sanitizeSourceUrl` extracting first valid URL and `sanitizeUserUrl` restoring user-provided URLs (Sacred Rule 1) are both correct.
- **Error classification** — `friendlyError()` correctly hides internal details from clients.
- **Firestore subcollection isolation** — per-user data architecture is correct and complete.
- **Client state reset on user switch** — `[user?.uid]` dependency + explicit resets prevent cross-user state contamination.
