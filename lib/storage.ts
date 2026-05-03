import fs from "fs";
import path from "path";
import { Profile, TripWorkspace } from "@/types";
import defaultProfile from "@/data/defaultProfile.json";

const DATA_DIR = path.join(process.cwd(), "data", "local");
const PROFILE_PATH = path.join(DATA_DIR, "profile.json");
const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(WORKSPACES_DIR)) fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
}

export function getProfile(): Profile {
  ensureDirs();
  if (!fs.existsSync(PROFILE_PATH)) {
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(defaultProfile, null, 2));
  }
  return JSON.parse(fs.readFileSync(PROFILE_PATH, "utf-8")) as Profile;
}

export function saveProfile(profile: Profile): void {
  ensureDirs();
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
}

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
  const filePath = path.join(WORKSPACES_DIR, `${workspace.id}.json`);
  workspace.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(workspace, null, 2));
}

export function deleteWorkspace(id: string): void {
  ensureDirs();
  const filePath = path.join(WORKSPACES_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
