/**
 * Prompt quality monitor — server-side only (imports adminDb).
 *
 * Rule-based audit of every searchAndScore result set. Detects:
 * - Axis name leakage in fitExplanation/tradeoffs
 * - Leftover citation markers
 * - OTA/aggregator source URLs
 * - Missing fitExplanations
 *
 * Results are stored to Firestore `searchQualityLog` (non-fatal write).
 * Only logs when issues are found — clean responses don't clutter the log.
 *
 * To review: Firebase console → searchQualityLog, sort by ts desc.
 * A falling qualityScore average indicates prompt drift or a model change.
 */

import { ScoredOption } from "@/types";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// These names should never appear in user-facing text fields
const AXIS_NAME_RE =
  /\b(calm|designSincerity|valueIntegrity|socialPermeability|autonomy|novelty|locationFriction)\b/;
const CITATION_RE = /\[\d+(?:,\s*\d+)*\]/;
// OTA booking pages we don't want as source URLs
const OTA_SOURCE_RE =
  /\b(booking\.com|tripadvisor\.|expedia\.|hotels\.com|marriott\.com|hilton\.com|hyatt\.com|agoda\.com)\b/i;

export interface QualityIssue {
  resultName: string;
  field: string;
  type: "axis_name_leak" | "citation_leak" | "ota_source" | "missing_fit" | "missing_source";
}

export function auditResults(results: ScoredOption[]): {
  issues: QualityIssue[];
  score: number;
} {
  const issues: QualityIssue[] = [];

  for (const r of results) {
    // fitExplanation checks
    if (!r.fitExplanation?.trim()) {
      issues.push({ resultName: r.name, field: "fitExplanation", type: "missing_fit" });
    } else {
      if (AXIS_NAME_RE.test(r.fitExplanation))
        issues.push({ resultName: r.name, field: "fitExplanation", type: "axis_name_leak" });
      if (CITATION_RE.test(r.fitExplanation))
        issues.push({ resultName: r.name, field: "fitExplanation", type: "citation_leak" });
    }

    // tradeoffs checks
    for (const t of r.tradeoffs ?? []) {
      if (AXIS_NAME_RE.test(t)) {
        issues.push({ resultName: r.name, field: "tradeoffs", type: "axis_name_leak" });
        break;
      }
    }

    // source checks
    if (!r.source) {
      issues.push({ resultName: r.name, field: "source", type: "missing_source" });
    } else if (OTA_SOURCE_RE.test(r.source)) {
      issues.push({ resultName: r.name, field: "source", type: "ota_source" });
    }
  }

  const maxPossible = results.length * 4; // 4 checks per result
  const score =
    maxPossible === 0
      ? 100
      : Math.max(0, Math.round(((maxPossible - issues.length) / maxPossible) * 100));

  return { issues, score };
}

/**
 * Write quality audit to Firestore — non-fatal, fire-and-forget.
 * Logs every search (not just flagged ones) so future qualitative re-scoring
 * jobs can evaluate voice quality across the full history, not just exceptions.
 */
export async function logSearchQuality(
  searchId: string,
  query: string,
  category: string,
  results: ScoredOption[],
  model?: string
): Promise<void> {
  const { issues, score } = auditResults(results);

  try {
    await adminDb.collection("searchQualityLog").add({
      searchId,
      query,
      category,
      model: model ?? "unknown",
      score,
      issues,
      resultCount: results.length,
      // Judgment lines — the content a future voice-quality re-scorer needs.
      // Stored on every call so historical searches can be backfill-scored.
      judgments: results.map((r) => ({
        name: r.name,
        fitExplanation: r.fitExplanation ?? "",
        tradeoffs: r.tradeoffs ?? [],
      })),
      ts: Timestamp.now(),
    });
    if (score < 70) {
      console.warn(
        `[QUALITY] Low score ${score} for "${query}" — ${issues.length} issue(s): ` +
          issues
            .slice(0, 3)
            .map((i) => `${i.type}(${i.field})`)
            .join(", ")
      );
    }
  } catch {
    // non-fatal
  }
}
