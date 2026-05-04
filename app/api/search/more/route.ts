import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, saveWorkspace } from "@/lib/storage";
import { searchMoreOptions } from "@/lib/claude";
import { combineProfiles } from "@/lib/scoring";

export async function POST(request: Request) {
  try {
    const { workspaceId, searchId } = await request.json();

    const workspace = getWorkspace(workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const search = workspace.searches.find((s) => s.id === searchId);
    if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 });

    // Build profile: combine all travelers if more than one
    const allProfiles = getProfiles();
    const travelerProfiles = workspace.travelers
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const profile = travelerProfiles.length > 1
      ? combineProfiles(travelerProfiles)
      : (travelerProfiles[0] ?? getProfile());

    // Names already seen in this search
    const alreadySeen = search.scoredResults.map((r) => r.name);

    const newResults = await searchMoreOptions(
      search.query,
      search.category,
      searchId,
      profile,
      alreadySeen
    );

    // Append to existing search results
    const updatedSearch = {
      ...search,
      scoredResults: [...search.scoredResults, ...newResults],
    };

    const updatedWorkspace = {
      ...workspace,
      searches: workspace.searches.map((s) => (s.id === searchId ? updatedSearch : s)),
    };

    saveWorkspace(updatedWorkspace);
    return NextResponse.json(updatedSearch);
  } catch (e) {
    console.error("Search more error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
