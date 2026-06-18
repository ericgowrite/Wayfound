import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, saveWorkspace } from "@/lib/storage";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { searchMoreOptions } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { friendlyError } from "@/lib/errorMessages";

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    const { workspaceId, searchId } = await request.json();

    const workspace = await getWorkspace(userId, workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const search = workspace.searches.find((s) => s.id === searchId);
    if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 });

    const allProfiles = await getProfiles(userId);
    const travelerProfiles = workspace.travelers
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const defaultProfile = await getProfile(userId);
    const profiles = travelerProfiles.length > 0 ? travelerProfiles : (defaultProfile ? [defaultProfile] : []);

    const alreadySeen = search.scoredResults.map((r) => r.name);
    const rawResults = await searchMoreOptions(search.query, search.category, searchId, profiles, alreadySeen);
    const newResults = attachTravelerScores(rawResults, travelerProfiles);

    const updatedSearch = { ...search, scoredResults: [...search.scoredResults, ...newResults] };
    const updatedWorkspace = {
      ...workspace,
      searches: workspace.searches.map((s) => (s.id === searchId ? updatedSearch : s)),
    };

    await saveWorkspace(userId, updatedWorkspace);
    return NextResponse.json(updatedSearch);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Search more error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
