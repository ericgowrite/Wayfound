/**
 * Storage layer — Firestore (Admin SDK)
 *
 * All reads/writes go through Firebase Admin, so data persists across
 * deployments and serverless cold starts. Admin SDK bypasses Firestore
 * security rules, making auth headers unnecessary for server routes.
 *
 * Collections:
 *   config/profiles   – single document { profiles: Profile[] }
 *   workspaces/{id}   – one document per TripWorkspace
 *
 * One-time migration: on first boot, if Firestore is empty, the module
 * seeds from data/local/ so existing dev data is not lost.
 */

import { adminDb } from "@/lib/firebase-admin";
import { Profile, TripWorkspace } from "@/types";
import fs from "fs";
import path from "path";

// ── Firestore refs ────────────────────────────────────────────────────────────

const PROFILES_REF = adminDb.collection("config").doc("profiles");
const WORKSPACES = adminDb.collection("workspaces");

// ── Default profile (fallback when Firestore is empty) ────────────────────────

const DEFAULT_PROFILE: Profile = {
  id: "eric-9w8",
  name: "Eric",
  enneagramType: "9w8",
  description:
    "Peacemaker with Challenger wing — needs harmony and ease but with substance and directness",
  axisWeights: {
    calm: 0.8,
    designSincerity: 0.85,
    valueIntegrity: 0.9,
    socialPermeability: 0.7,
    autonomy: 0.6,
    novelty: 0.5,
    locationFriction: 0.4,
  },
  thresholds: { calm: 0.5, valueIntegrity: 0.6 },
  dealbreakers: [
    "Feeling rushed or overscheduled",
    "Performative luxury that's just expensive",
    "Nickel-and-diming or hidden costs",
    "Forced group dynamics with no escape",
  ],
  isDefault: true,
};

// ── One-time migration from local filesystem ──────────────────────────────────

const LOCAL_DIR = path.join(process.cwd(), "data", "local");
const LOCAL_PROFILES = path.join(LOCAL_DIR, "profiles.json");
const LOCAL_LEGACY_PROFILE = path.join(LOCAL_DIR, "profile.json");
const LOCAL_WORKSPACES = path.join(LOCAL_DIR, "workspaces");

function readLocalProfiles(): Profile[] | null {
  try {
    if (fs.existsSync(LOCAL_PROFILES)) {
      return JSON.parse(fs.readFileSync(LOCAL_PROFILES, "utf-8")) as Profile[];
    }
    if (fs.existsSync(LOCAL_LEGACY_PROFILE)) {
      const legacy = JSON.parse(fs.readFileSync(LOCAL_LEGACY_PROFILE, "utf-8"));
      return [
        {
          id: legacy.id ?? "eric-9w8",
          name: legacy.name ?? "Eric",
          enneagramType: legacy.type ?? legacy.enneagramType ?? "9w8",
          description: legacy.description ?? "",
          axisWeights: legacy.axisWeights,
          thresholds: legacy.thresholds ?? {},
          dealbreakers: legacy.dealbreakers ?? [],
          isDefault: true,
        },
      ];
    }
  } catch {}
  return null;
}

function readLocalWorkspaces(): TripWorkspace[] {
  try {
    if (!fs.existsSync(LOCAL_WORKSPACES)) return [];
    return fs
      .readdirSync(LOCAL_WORKSPACES)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(
            fs.readFileSync(path.join(LOCAL_WORKSPACES, f), "utf-8")
          ) as TripWorkspace;
        } catch {
          return null;
        }
      })
      .filter((w): w is TripWorkspace => w !== null);
  } catch {
    return [];
  }
}

async function migrateLocalToFirestore(): Promise<Profile[]> {
  const localProfiles = readLocalProfiles() ?? [DEFAULT_PROFILE];
  const localWorkspaces = readLocalWorkspaces();

  // Write profiles
  await PROFILES_REF.set({ profiles: localProfiles });

  // Write workspaces in parallel
  const batch = adminDb.batch();
  for (const ws of localWorkspaces) {
    batch.set(WORKSPACES.doc(ws.id), ws);
  }
  if (localWorkspaces.length > 0) await batch.commit();

  console.log(
    `[VIYA-STORAGE] Migrated ${localProfiles.length} profile(s) and ${localWorkspaces.length} workspace(s) to Firestore`
  );
  return localProfiles;
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const snap = await PROFILES_REF.get();
  if (!snap.exists) {
    // First boot — migrate from local filesystem (or seed default)
    return migrateLocalToFirestore();
  }
  return (snap.data()?.profiles ?? []) as Profile[];
}

export async function getProfile(id?: string): Promise<Profile> {
  const profiles = await getProfiles();
  if (id) {
    const found = profiles.find((p) => p.id === id);
    if (found) return found;
  }
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? DEFAULT_PROFILE;
}

export async function saveProfileToList(profile: Profile): Promise<void> {
  const profiles = await getProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  await PROFILES_REF.set({ profiles });
}

export async function deleteProfileFromList(id: string): Promise<void> {
  const profiles = (await getProfiles()).filter((p) => p.id !== id);
  await PROFILES_REF.set({ profiles });
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function getWorkspaces(): Promise<TripWorkspace[]> {
  // Ensure migration has run (profiles doc is the canary)
  const profilesSnap = await PROFILES_REF.get();
  if (!profilesSnap.exists) await migrateLocalToFirestore();

  const snap = await WORKSPACES.orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => d.data() as TripWorkspace);
}

export async function getWorkspace(id: string): Promise<TripWorkspace | null> {
  const doc = await WORKSPACES.doc(id).get();
  return doc.exists ? (doc.data() as TripWorkspace) : null;
}

export async function saveWorkspace(workspace: TripWorkspace): Promise<void> {
  workspace.updatedAt = new Date().toISOString();
  await WORKSPACES.doc(workspace.id).set(workspace);
}

export async function deleteWorkspace(id: string): Promise<void> {
  await WORKSPACES.doc(id).delete();
}
