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
import { Profile, TripWorkspace } from "@/types";

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
  const profiles = await getProfiles(userId);
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  await profilesRef(userId).set({ profiles });
}

export async function deleteProfileFromList(userId: string, id: string): Promise<void> {
  const profiles = (await getProfiles(userId)).filter((p) => p.id !== id);
  await profilesRef(userId).set({ profiles });
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function getWorkspaces(userId: string): Promise<TripWorkspace[]> {
  const snap = await workspacesCol(userId).orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => d.data() as TripWorkspace);
}

export async function getWorkspace(userId: string, id: string): Promise<TripWorkspace | null> {
  const doc = await workspacesCol(userId).doc(id).get();
  return doc.exists ? (doc.data() as TripWorkspace) : null;
}

export async function saveWorkspace(userId: string, workspace: TripWorkspace): Promise<void> {
  workspace.updatedAt = new Date().toISOString();
  await workspacesCol(userId).doc(workspace.id).set(workspace);
}

export async function deleteWorkspace(userId: string, id: string): Promise<void> {
  await workspacesCol(userId).doc(id).delete();
}
