/**
 * Dev-only endpoint: fit score variance test across Enneagram type pairs.
 *
 * GET /api/dev/fit-variance
 *   → runs 2 type pairs × 2 queries, returns an HTML report
 *
 * What it tests:
 *   1. Axis score consistency  — same property scored twice should return similar axis values
 *   2. Ranking differentiation — different types should produce different orderings
 *   3. Spearman rank correlation — near 0 = good personalization, near 1 = no differentiation
 *   4. Coverage overlap — what % of results are shared across type queries
 */

import { NextResponse } from "next/server";
import { CORE_ARCHETYPES } from "@/lib/assessment";
import { searchAndScore } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { Profile, ScoredOption, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ── Config ────────────────────────────────────────────────────────────────────

// Contrasting type pairs chosen for maximum axis divergence
const TYPE_PAIRS: [number, number][] = [
  [3, 9], // Achiever (driven, high novelty, low calm) vs Peacemaker (serene, high calm, low novelty)
  [7, 5], // Enthusiast (high autonomy, social, novelty) vs Investigator (private, calm, immersive)
];

const TEST_QUERIES: { query: string; category: SearchCategory; destination: string }[] = [
  { query: "boutique hotel with character", category: "accommodation", destination: "Barcelona, Spain" },
  { query: "authentic local restaurant", category: "restaurant", destination: "Tokyo, Japan" },
];

const TOP_N = 6; // results to compare per type

// ── Helpers ───────────────────────────────────────────────────────────────────

function archetypeToProfile(type: number): Profile {
  const a = CORE_ARCHETYPES[type];
  return {
    id: `test-type-${type}`,
    name: a.name,
    enneagramType: `Type ${type}`,
    description: a.description,
    axisWeights: { ...a.axisWeights },
    thresholds: {},
    dealbreakers: [],
  };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
}

/** Spearman rank correlation for two equal-length rank arrays */
function spearman(ranksA: number[], ranksB: number[]): number {
  const n = ranksA.length;
  if (n < 2) return 0;
  const d2 = ranksA.reduce((sum, ra, i) => sum + Math.pow(ra - ranksB[i], 2), 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

/** Mean absolute axis score difference across all 7 axes */
function axisDelta(a: ScoredOption["axisScores"], b: ScoredOption["axisScores"]): number {
  const keys = Object.keys(a) as (keyof typeof a)[];
  const total = keys.reduce((sum, k) => sum + Math.abs(a[k] - b[k]), 0);
  return total / keys.length;
}

interface OverlappingResult {
  name: string;
  rankA: number;
  rankB: number;
  fitA: number;
  fitB: number;
  meanAxisDelta: number;
  axisA: ScoredOption["axisScores"];
  axisB: ScoredOption["axisScores"];
}

interface QueryComparison {
  typeA: number;
  typeB: number;
  query: string;
  destination: string;
  category: SearchCategory;
  resultsA: ScoredOption[];
  resultsB: ScoredOption[];
  overlapping: OverlappingResult[];
  rho: number | null;
  overlapPct: number;
  durationMs: number;
}

// ── Core comparison ───────────────────────────────────────────────────────────

async function compareTypes(
  typeA: number,
  typeB: number,
  query: string,
  category: SearchCategory,
  destination: string,
  skipCache: boolean
): Promise<QueryComparison> {
  const t0 = Date.now();
  const profileA = archetypeToProfile(typeA);
  const profileB = archetypeToProfile(typeB);

  // Run in parallel — each gets its own cache key via the differing profile weights
  const [rawA, rawB] = await Promise.all([
    searchAndScore(query, category, uuidv4(), [profileA], destination, undefined, undefined, skipCache),
    searchAndScore(query, category, uuidv4(), [profileB], destination, undefined, undefined, skipCache),
  ]);

  const resultsA = attachTravelerScores(rawA, [profileA]).slice(0, TOP_N);
  const resultsB = attachTravelerScores(rawB, [profileB]).slice(0, TOP_N);

  // Match by normalized name
  const mapA = new Map(resultsA.map((r, i) => [normalizeName(r.name), { r, rank: i + 1 }]));

  const overlapping: OverlappingResult[] = [];
  for (let i = 0; i < resultsB.length; i++) {
    const key = normalizeName(resultsB[i].name);
    const match = mapA.get(key);
    if (match) {
      overlapping.push({
        name: resultsB[i].name,
        rankA: match.rank,
        rankB: i + 1,
        fitA: match.r.alignmentScore,
        fitB: resultsB[i].alignmentScore,
        meanAxisDelta: axisDelta(match.r.axisScores, resultsB[i].axisScores),
        axisA: match.r.axisScores,
        axisB: resultsB[i].axisScores,
      });
    }
  }

  // Spearman requires n≥3 to produce a value in [-1, 1]; below that the
  // formula can return values outside that range which are meaningless.
  const rho =
    overlapping.length >= 3
      ? spearman(
          overlapping.map((o) => o.rankA),
          overlapping.map((o) => o.rankB)
        )
      : null;

  const overlapPct = Math.round(
    (overlapping.length / Math.max(resultsA.length, resultsB.length)) * 100
  );

  return {
    typeA, typeB, query, destination, category,
    resultsA, resultsB, overlapping, rho, overlapPct,
    durationMs: Date.now() - t0,
  };
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function rhoLabel(rho: number | null): string {
  if (rho === null) return "N/A (too few overlapping results)";
  const r = Math.round(rho * 100) / 100;
  const signal =
    rho < 0.3 ? "✅ Strong differentiation"
    : rho < 0.6 ? "⚠️ Moderate differentiation"
    : "🔴 Weak differentiation — rankings too similar";
  return `${r.toFixed(2)} — ${signal}`;
}

function axisRow(
  key: string,
  vA: number,
  vB: number
): string {
  const delta = Math.abs(vA - vB);
  const flag = delta > 0.15 ? " ⚠️" : "";
  return `<tr>
    <td style="padding:2px 8px;color:#6B8299;font-size:11px">${key}</td>
    <td style="padding:2px 8px;text-align:right;font-size:11px">${pct(vA)}</td>
    <td style="padding:2px 8px;text-align:right;font-size:11px">${pct(vB)}</td>
    <td style="padding:2px 8px;text-align:right;font-size:11px;color:${delta > 0.15 ? "#e8624a" : "#9BB0C1"}">${pct(delta)}${flag}</td>
  </tr>`;
}

function renderComparison(c: QueryComparison, idx: number): string {
  const archetypeA = CORE_ARCHETYPES[c.typeA];
  const archetypeB = CORE_ARCHETYPES[c.typeB];

  const topA = c.resultsA.slice(0, 5).map((r, i) =>
    `<li style="padding:3px 0;font-size:12px"><b>#${i + 1}</b> ${r.name} <span style="color:#5B8BA0">(fit: ${r.alignmentScore})</span></li>`
  ).join("");

  const topB = c.resultsB.slice(0, 5).map((r, i) =>
    `<li style="padding:3px 0;font-size:12px"><b>#${i + 1}</b> ${r.name} <span style="color:#5B8BA0">(fit: ${r.alignmentScore})</span></li>`
  ).join("");

  const overlapRows = c.overlapping.map((o) => {
    const axisKeys = Object.keys(o.axisA) as (keyof typeof o.axisA)[];
    const axisTable = `<table style="border-collapse:collapse;margin-top:4px">
      <tr style="color:#9BB0C1;font-size:10px"><th style="padding:2px 8px;text-align:left">axis</th><th style="padding:2px 8px">Type ${c.typeA}</th><th style="padding:2px 8px">Type ${c.typeB}</th><th style="padding:2px 8px">Δ</th></tr>
      ${axisKeys.map(k => axisRow(k, o.axisA[k], o.axisB[k])).join("")}
    </table>`;

    return `<div style="background:#F7FAFB;border:1px solid #E0E8ED;border-radius:8px;padding:10px;margin-bottom:8px">
      <div style="font-weight:600;font-size:13px">${o.name}</div>
      <div style="font-size:11px;color:#6B8299;margin-top:2px">
        Rank: <b>T${c.typeA} #${o.rankA}</b> (fit ${o.fitA}) → <b>T${c.typeB} #${o.rankB}</b> (fit ${o.fitB})
        &nbsp;·&nbsp; Mean axis Δ: <span style="color:${o.meanAxisDelta > 0.1 ? "#e8624a" : "#3BAE6E"}">${pct(o.meanAxisDelta)}</span>
      </div>
      ${axisTable}
    </div>`;
  }).join("") || "<p style='color:#9BB0C1;font-size:12px'>No overlapping results — Gemini returned entirely different properties for each type.</p>";

  return `<div style="border:1px solid #E0E8ED;border-radius:12px;padding:20px;margin-bottom:24px">
    <h2 style="margin:0 0 4px;font-size:16px;color:#2C3E50">
      Test ${idx + 1}: Type ${c.typeA} (${archetypeA.name}) vs Type ${c.typeB} (${archetypeB.name})
    </h2>
    <p style="margin:0 0 16px;color:#6B8299;font-size:12px">
      "${c.query}" · ${c.category} · ${c.destination} · ${c.durationMs}ms
    </p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:11px;text-transform:uppercase;color:#9BB0C1;margin-bottom:6px">
          Type ${c.typeA} — ${archetypeA.tagline}
        </div>
        <ol style="margin:0;padding-left:18px">${topA}</ol>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;color:#9BB0C1;margin-bottom:6px">
          Type ${c.typeB} — ${archetypeB.tagline}
        </div>
        <ol style="margin:0;padding-left:18px">${topB}</ol>
      </div>
    </div>

    <div style="background:#EEF4F8;border-radius:8px;padding:12px;margin-bottom:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center">
      <div>
        <div style="font-size:20px;font-weight:700;color:#2C3E50">${c.overlapPct}%</div>
        <div style="font-size:11px;color:#6B8299">Result overlap</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:#2C3E50">${c.overlapping.length}</div>
        <div style="font-size:11px;color:#6B8299">Shared properties</div>
      </div>
      <div>
        <div style="font-size:14px;font-weight:600;color:#2C3E50;margin-top:4px">${rhoLabel(c.rho)}</div>
        <div style="font-size:11px;color:#6B8299">Rank correlation (ρ)</div>
      </div>
    </div>

    <h3 style="font-size:13px;color:#2C3E50;margin:0 0 8px">Overlapping properties — axis score consistency check</h3>
    <p style="font-size:11px;color:#9BB0C1;margin:0 0 10px">
      Axis scores describe the <em>property</em>, not the traveler — high Δ here means Gemini is scoring inconsistently across calls (a data quality issue, not a personalization signal).
    </p>
    ${overlapRows}
  </div>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("This endpoint is only available in development.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const skipCache = searchParams.get("bust") === "1";

  const t0 = Date.now();
  const results: QueryComparison[] = [];
  const errors: string[] = [];

  for (const [typeA, typeB] of TYPE_PAIRS) {
    for (const tq of TEST_QUERIES) {
      try {
        const c = await compareTypes(typeA, typeB, tq.query, tq.category, tq.destination, skipCache);
        results.push(c);
      } catch (e) {
        const msg = `Type ${typeA} vs ${typeB} · "${tq.query}": ${e instanceof Error ? e.message : String(e)}`;
        errors.push(msg);
        console.error("[fit-variance]", msg);
      }
    }
  }

  const totalMs = Date.now() - t0;
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ViyaWay — Fit Score Variance Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #2C3E50; background: #fff; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #6B8299; font-size: 13px; margin-bottom: 32px; }
    .legend { background: #F7FAFB; border: 1px solid #E0E8ED; border-radius: 8px; padding: 14px 18px; margin-bottom: 28px; font-size: 12px; color: #6B8299; line-height: 1.7; }
    .legend strong { color: #2C3E50; }
    .error { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; color: #B91C1C; }
  </style>
</head>
<body>
  <h1>Fit Score Variance Report</h1>
  <p class="meta">Generated ${new Date().toISOString()} · ${results.length} comparisons · ${totalMs}ms total · ${skipCache ? "⚡ cache bypassed (fresh Gemini calls)" : "✓ cache enabled — add ?bust=1 to force fresh calls"}</p>

  <div class="legend">
    <strong>What this tests:</strong><br>
    <b>Rank correlation (ρ)</b> — Spearman correlation between how each type ranks shared properties.
    ρ near 0 = meaningful differentiation (good). ρ near 1 = rankings identical = personalization not working.<br>
    <b>Axis Δ on overlapping results</b> — Axis scores describe the <em>property</em>, not the traveler.
    Consistent scores across types (low Δ) = Gemini is reliable. High Δ = Gemini is being influenced by the profile in ways it shouldn't be.<br>
    <b>Result overlap</b> — What % of properties appear in both type results. Low overlap = profile is influencing discovery. High overlap = same places regardless of type.
  </div>

  ${errors.map(e => `<div class="error">⚠️ Error: ${e}</div>`).join("")}
  ${results.map((c, i) => renderComparison(c, i)).join("")}
</body>
</html>`;

  return new NextResponse(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
