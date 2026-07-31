import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, getWorkspaces, saveWorkspace } from "@/lib/storage";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { searchMoreOptions } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { friendlyError } from "@/lib/errorMessages";

const ANON_SEARCH_LIMIT = 1;

export async function POST(request: Request) {
  try {
    const { uid: userId, isAnonymous } = await getTokenClaims(request);
    const { workspaceId, searchId } = await request.json();

    if (isAnonymous) {
      const allWorkspaces = await getWorkspaces(userId);
      const totalSearches = allWorkspaces.reduce((n, w) => n + w.searches.length, 0);
      if (totalSearches >= ANON_SEARCH_LIMIT) {
        return NextResponse.json(
          { error: "Sign in to keep searching.", code: "ANON_LIMIT" },
          { status: 403 }
        );
      }
    }

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
    const rawResults = await searchMoreOptions(search.query, search.category, searchId, profiles, alreadySeen, workspace.destination, workspace.dates, workspace.partySize);
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
