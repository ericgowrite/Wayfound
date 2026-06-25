/**
 * Storage layer — Firestore (Admin SDK), per-user scoped
 *
 * All data lives under users/{userId}/ so each account is fully isolated.
 * Admin SDK bypasses Firestore security rules — auth is enforced at the
 * API route level via lib/serverAuth.ts.
 *
 * Paths:
 *   users/{userId}/config/profiles  – document { profiles: Profile[] }
 *   users/{userId}/workspaces/{id}  – one document per TripWorkspace
 */

import { adminDb } from "@/lib/firebase-admin";
import { JourneyState, Profile, SavedOption, TripWorkspace } from "@/types";

// Maps legacy ScoredOption.status values to the new journeyState field.
// Runs transparently on every read so existing saved data is never broken.
function hydrateSavedOption(opt: SavedOption): SavedOption {
  if (opt.journeyState) return opt;
  const map: Record<string, JourneyState> = {
    interested: "interested",
    booked: "booked",
    rejected: "not_going",
  };
  return { ...opt, journeyState: map[opt.status] ?? "saved" };
}

function hydrateWorkspace(ws: TripWorkspace): TripWorkspace {
  if (!ws.savedOptions?.length) return ws;
  return { ...ws, savedOptions: ws.savedOptions.map(hydrateSavedOption) };
}

function profilesRef(userId: string) {
  return adminDb.collection("users").doc(userId).collection("config").doc("profiles");
}

function workspacesCol(userId: string) {
  return adminDb.collection("users").doc(userId).collection("workspaces");
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfiles(userId: string): Promise<Profile[]> {
  const snap = await profilesRef(userId).get();
  return snap.exists ? ((snap.data()?.profiles ?? []) as Profile[]) : [];
}

export async function getProfile(userId: string, id?: string): Promise<Profile | null> {
  const profiles = await getProfiles(userId);
  if (id) {
    const found = profiles.find((p) => p.id === id);
    if (found) return found;
  }
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
}

export async function saveProfileToList(userId: string, profile: Profile): Promise<void> {
  const ref = profilesRef(userId);
  // Use a transaction to prevent a read-modify-write race when two profile
  // saves arrive concurrently (e.g. calibration accept + profile editor save).
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const profiles: Profile[] = snap.exists ? ((snap.data()?.profiles ?? []) as Profile[]) : [];
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) profiles[idx] = profile;
    else profiles.push(profile);
    tx.set(ref, { profiles });
  });
}

export async function deleteProfileFromList(userId: string, id: string): Promise<void> {
  const ref = profilesRef(userId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const profiles: Profile[] = snap.exists ? ((snap.data()?.profiles ?? []) as Profile[]) : [];
    tx.set(ref, { profiles: profiles.filter((p) => p.id !== id) });
  });
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function getWorkspaces(userId: string): Promise<TripWorkspace[]> {
  const snap = await workspacesCol(userId).orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => hydrateWorkspace(d.data() as TripWorkspace));
}

export async function getWorkspace(userId: string, id: string): Promise<TripWorkspace | null> {
  const doc = await workspacesCol(userId).doc(id).get();
  return doc.exists ? hydrateWorkspace(doc.data() as TripWorkspace) : null;
}

export async function saveWorkspace(userId: string, workspace: TripWorkspace): Promise<void> {
  workspace.updatedAt = new Date().toISOString();
  // JSON round-trip removes undefined fields that Firestore rejects
  const data = JSON.parse(JSON.stringify(workspace));
  await workspacesCol(userId).doc(workspace.id).set(data);
}

export async function deleteWorkspace(userId: string, id: string): Promise<void> {
  await workspacesCol(userId).doc(id).delete();
}
