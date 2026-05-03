import fs from "fs";
import path from "path";
import { Profile, TripWorkspace } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data", "local");
const PROFILES_PATH = path.join(DATA_DIR, "profiles.json");
const LEGACY_PROFILE_PATH = path.join(DATA_DIR, "profile.json");
const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");

const DEFAULT_PROFILE: Profile = {
  id: "eric-9w8",
  name: "Eric",
  enneagramType: "9w8",
  description: "Peacemaker with Challenger wing — needs harmony and ease but with substance and directness",
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

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(WORKSPACES_DIR)) fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
}

function migrateAndLoadProfiles(): Profile[] {
  // Try new profiles.json first
  if (fs.existsSync(PROFILES_PATH)) {
    return JSON.parse(fs.readFileSync(PROFILES_PATH, "utf-8")) as Profile[];
  }
  // Migrate from legacy single profile.json
  if (fs.existsSync(LEGACY_PROFILE_PATH)) {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_PROFILE_PATH, "utf-8"));
    const migrated: Profile = {
      id: legacy.id ?? "eric-9w8",
      name: legacy.name ?? "Eric",
      enneagramType: legacy.type ?? legacy.enneagramType ?? "9w8",
      description: legacy.description ?? "",
      axisWeights: legacy.axisWeights,
      thresholds: legacy.thresholds ?? {},
      dealbreakers: legacy.dealbreakers ?? [],
      isDefault: true,
    };
    const profiles = [migrated];
    fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    return profiles;
  }
  // No data yet — seed with default
  const profiles = [DEFAULT_PROFILE];
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
  return profiles;
}

// ── Profiles ────────────────────────────────────────────────────────────────

export function getProfiles(): Profile[] {
  ensureDirs();
  return migrateAndLoadProfiles();
}

export function getProfile(id?: string): Profile {
  const profiles = getProfiles();
  if (id) {
    const found = profiles.find((p) => p.id === id);
    if (found) return found;
  }
  // Fall back to default or first
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? DEFAULT_PROFILE;
}

export function saveProfileToList(profile: Profile): void {
  ensureDirs();
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
}

export function deleteProfileFromList(id: string): void {
  ensureDirs();
  const profiles = getProfiles().filter((p) => p.id !== id);
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export function getWorkspaces(): TripWorkspace[] {
  ensureDirs();
  const files = fs.readdirSync(WORKSPACES_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(WORKSPACES_DIR, f), "utf-8")) as TripWorkspace)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getWorkspace(id: string): TripWorkspace | null {
  ensureDirs();
  const filePath = path.join(WORKSPACES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as TripWorkspace;
}

export function saveWorkspace(workspace: TripWorkspace): void {
  ensureDirs();
  workspace.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(WORKSPACES_DIR, `${workspace.id}.json`), JSON.stringify(workspace, null, 2));
}

export function deleteWorkspace(id: string): void {
  ensureDirs();
  const filePath = path.join(WORKSPACES_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
