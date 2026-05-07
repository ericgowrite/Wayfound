import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace } from "@/lib/storage";
import { generateComparison } from "@/lib/gemini";
import { ScoredOption } from "@/types";

export async function POST(request: Request) {
  try {
    const { options, workspaceId } = await request.json() as {
      options: ScoredOption[];
      workspaceId?: string;
    };

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

    const summary = await generateComparison(options, profiles);
    return NextResponse.json({ summary });
  } catch (e) {
    console.error("Compare error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
