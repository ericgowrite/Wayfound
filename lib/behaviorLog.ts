/**
 * Firestore helpers for the passive personalization loop.
 *
 * Data lives under:
 *   users/{uid}/profileBehavior/{profileId}/behaviorEvents/{eventId}
 *   users/{uid}/profileBehavior/{profileId}/workspaceWeights/{workspaceId}
 *   users/{uid}/profileBehavior/{profileId}/searchHistory/{searchId}
 *
 * These are subcollections off a virtual "profileBehavior" document so they can
 * be scaled independently from the main profiles config document.
 */

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { BehaviorEvent, WorkspaceWeights, SearchHistoryEntry } from "@/types";
import { v4 as uuidv4 } from "uuid";

function profileBehaviorRef(userId: string, profileId: string) {
  return adminDb
    .collection("users")
    .doc(userId)
    .collection("profileBehavior")
    .doc(profileId);
}

// ── Workspace weights ─────────────────────────────────────────────────────────

export async function getWorkspaceWeights(
  userId: string,
  profileId: string,
  workspaceId: string
): Promise<WorkspaceWeights | null> {
  try {
    const doc = await profileBehaviorRef(userId, profileId)
      .collection("workspaceWeights")
      .doc(workspaceId)
      .get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      axisWeights: d.axisWeights,
      baseWeights: d.baseWeights,
      saveCount: d.saveCount ?? 0,
      createdAt: d.createdAt instanceof Timestamp
        ? d.createdAt.toDate().toISOString()
        : (d.createdAt as string),
    };
  } catch {
    return null;
  }
}

export async function setWorkspaceWeights(
  userId: string,
  profileId: string,
  workspaceId: string,
  weights: WorkspaceWeights
): Promise<void> {
  const ref = profileBehaviorRef(userId, profileId)
    .collection("workspaceWeights")
    .doc(workspaceId);

  const data = {
    ...weights,
    createdAt: weights.createdAt ?? new Date().toISOString(),
    updatedAt: Timestamp.now(),
  };
  await ref.set(data, { merge: true });
}

// ── Behavior events ───────────────────────────────────────────────────────────

export async function logBehaviorEvent(
  userId: string,
  profileId: string,
  event: BehaviorEvent
): Promise<string> {
  const id = uuidv4();
  const ref = profileBehaviorRef(userId, profileId)
    .collection("behaviorEvents")
    .doc(id);
  await ref.set({
    ...event,
    id,
    createdAt: Timestamp.now(),
  });
  return id;
}

// ── Search history ────────────────────────────────────────────────────────────

export async function logSearchHistory(
  userId: string,
  profileId: string,
  entry: SearchHistoryEntry
): Promise<void> {
  const ref = profileBehaviorRef(userId, profileId)
    .collection("searchHistory")
    .doc(entry.id);
  await ref.set({
    ...entry,
    createdAt: Timestamp.now(),
  });
}

/** Returns the last N queries within the given workspace (newest first). */
export async function getRecentWorkspaceSearches(
  userId: string,
  profileId: string,
  workspaceId: string,
  limit = 5
): Promise<string[]> {
  try {
    const snap = await profileBehaviorRef(userId, profileId)
      .collection("searchHistory")
      .where("workspaceId", "==", workspaceId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data().query as string);
  } catch {
    return [];
  }
}
