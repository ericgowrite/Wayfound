import { NextResponse } from "next/server";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { getProfile } from "@/lib/storage";
import { logBehaviorEvent, getWorkspaceWeights } from "@/lib/behaviorLog";
import { applyBehaviorNudge, rollUpToGlobal, shouldTriggerRollup } from "@/lib/behaviorNudge";
import { checkTypeReconciliation } from "@/lib/typeReconciliation";
import { BehaviorAction, BehaviorEvent, RejectReason } from "@/types";

const VALID_ACTIONS: BehaviorAction[] = ["save", "reject", "booked", "not_going"];
const VALID_REJECT_REASONS: RejectReason[] = ["fit", "price", "dates", "other"];

export async function POST(request: Request) {
  try {
    const { uid: userId, isAnonymous } = await getTokenClaims(request);

    // Behavior learning only applies to authenticated users.
    if (isAnonymous) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      profileId,
      workspaceId,
      action,
      reason,
      optionId,
      optionName,
      axisScores,
      fitScore,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────

    if (!profileId || typeof profileId !== "string") {
      return NextResponse.json({ error: "profileId is required" }, { status: 400 });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (action === "reject") {
      if (!reason || !VALID_REJECT_REASONS.includes(reason)) {
        return NextResponse.json(
          { error: "reason is required for reject actions — must be one of: fit, price, dates, other" },
          { status: 400 }
        );
      }
    }
    if (!optionId || typeof optionId !== "string") {
      return NextResponse.json({ error: "optionId is required" }, { status: 400 });
    }
    if (!axisScores || typeof axisScores !== "object") {
      return NextResponse.json({ error: "axisScores is required" }, { status: 400 });
    }

    // ── Load profile ──────────────────────────────────────────────────────────

    const profile = await getProfile(userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // ── Log event ─────────────────────────────────────────────────────────────

    const event: BehaviorEvent = {
      action,
      reason: action === "reject" ? reason : null,
      optionId,
      optionName: optionName ?? "",
      axisScores,
      fitScore: typeof fitScore === "number" ? fitScore : 0,
      workspaceId,
      timestamp: new Date().toISOString(),
    };

    await logBehaviorEvent(userId, profileId, event);

    // ── Apply workspace-scoped nudge ──────────────────────────────────────────

    const { nudgeApplied } = await applyBehaviorNudge(
      userId,
      profileId,
      event,
      profile.axisWeights
    );

    // ── Rollup check ──────────────────────────────────────────────────────────

    let rolledUpToGlobal = false;
    if (nudgeApplied) {
      const wsWeights = await getWorkspaceWeights(userId, profileId, workspaceId);
      if (shouldTriggerRollup(wsWeights, action)) {
        rolledUpToGlobal = await rollUpToGlobal(userId, profileId, workspaceId, profile);
      }
    }

    // ── Type reconciliation check (periodic, best-effort) ────────────────────

    if (rolledUpToGlobal) {
      // Re-read the profile since rollup may have updated it.
      const updatedProfile = await getProfile(userId, profileId);
      if (updatedProfile) {
        await checkTypeReconciliation(userId, updatedProfile).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, nudgeApplied, rolledUpToGlobal });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[behavior-event] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
