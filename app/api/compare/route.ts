import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace } from "@/lib/storage";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { generateComparison } from "@/lib/gemini";
import { friendlyError } from "@/lib/errorMessages";
import { ScoredOption } from "@/types";

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    const { options, workspaceId } = await request.json() as { options: ScoredOption[]; workspaceId?: string };

    const defaultProfile = await getProfile(userId);
    let profiles: import("@/types").Profile[] = defaultProfile ? [defaultProfile] : [];

    if (workspaceId) {
      const workspace = await getWorkspace(userId, workspaceId);
      if (workspace && workspace.travelers.length > 0) {
        const allProfiles = await getProfiles(userId);
        const travelerProfiles = workspace.travelers
          .map((id) => allProfiles.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => !!p);
        if (travelerProfiles.length > 0) profiles = travelerProfiles;
      }
    }

    const summary = await generateComparison(options, profiles);
    return NextResponse.json({ summary });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Compare error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
