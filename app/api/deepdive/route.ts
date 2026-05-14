import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace } from "@/lib/storage";
import { generateDeepDive } from "@/lib/gemini";
import { friendlyError } from "@/lib/errorMessages";
import { ScoredOption } from "@/types";

export async function POST(request: Request) {
  try {
    const { option, workspaceId } = await request.json() as { option: ScoredOption; workspaceId?: string };

    // Load traveler profiles from the workspace when available
    let profiles = [getProfile()];
    if (workspaceId) {
      const workspace = getWorkspace(workspaceId);
      if (workspace && workspace.travelers.length > 0) {
        const allProfiles = getProfiles();
        const travelerProfiles = workspace.travelers
          .map((id) => allProfiles.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => !!p);
        if (travelerProfiles.length > 0) profiles = travelerProfiles;
      }
    }

    const deepDive = await generateDeepDive(option, profiles);
    return NextResponse.json({ deepDive });
  } catch (e) {
    console.error("Deep dive error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
