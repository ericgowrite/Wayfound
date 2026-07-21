import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace } from "@/lib/storage";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { generateDeepDive } from "@/lib/gemini";
import { friendlyError } from "@/lib/errorMessages";
import { checkRateLimit } from "@/lib/rateLimit";
import { ScoredOption } from "@/types";

export async function POST(request: Request) {
  try {
    const { uid: userId, isAnonymous } = await getTokenClaims(request);

    const { allowed } = await checkRateLimit(userId, isAnonymous);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests — give it a minute.", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }
    const { option, workspaceId } = await request.json() as { option: ScoredOption; workspaceId?: string };

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

    const deepDive = await generateDeepDive(option, profiles);
    return NextResponse.json({ deepDive });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Deep dive error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
