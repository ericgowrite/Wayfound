import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, saveWorkspace } from "@/lib/storage";
import { searchMoreOptions } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { friendlyError } from "@/lib/errorMessages";

export async function POST(request: Request) {
  try {
    const { workspaceId, searchId } = await request.json();

    const workspace = await getWorkspace(workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const search = workspace.searches.find((s) => s.id === searchId);
    if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 });

    const allProfiles = await getProfiles();
    const travelerProfiles = workspace.travelers
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const profiles = travelerProfiles.length > 0 ? travelerProfiles : [await getProfile()];

    const alreadySeen = search.scoredResults.map((r) => r.name);
    const rawResults = await searchMoreOptions(
      search.query,
      search.category,
      searchId,
      profiles,
      alreadySeen
    );
    const newResults = attachTravelerScores(rawResults, travelerProfiles);

    const updatedSearch = {
      ...search,
      scoredResults: [...search.scoredResults, ...newResults],
    };

    const updatedWorkspace = {
      ...workspace,
      searches: workspace.searches.map((s) => (s.id === searchId ? updatedSearch : s)),
    };

    await saveWorkspace(updatedWorkspace);
    return NextResponse.json(updatedSearch);
  } catch (e) {
    console.error("Search more error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
