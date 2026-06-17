import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, saveWorkspace } from "@/lib/storage";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { scoreSpecific } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { friendlyError } from "@/lib/errorMessages";
import { Search, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const userId = await getUserId(request);
    const { workspaceId, input, category } = await request.json();

    const workspace = await getWorkspace(userId, workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const allProfiles = await getProfiles(userId);
    const travelerProfiles = workspace.travelers
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const defaultProfile = await getProfile(userId);
    const profiles = travelerProfiles.length > 0 ? travelerProfiles : (defaultProfile ? [defaultProfile] : []);
    const searchId = uuidv4();

    const raw = await scoreSpecific(input, category as SearchCategory, searchId, profiles);
    const [result] = attachTravelerScores([raw], travelerProfiles);

    const search: Search = {
      id: searchId,
      workspaceId,
      query: input,
      category: category as SearchCategory,
      rawResults: [],
      scoredResults: [result],
      searchedAt: new Date().toISOString(),
    };

    workspace.searches.unshift(search);
    await saveWorkspace(userId, workspace);

    return NextResponse.json(search);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Score error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
