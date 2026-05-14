import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, saveWorkspace } from "@/lib/storage";
import { searchAndScore } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { friendlyError } from "@/lib/errorMessages";
import { Search, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const { workspaceId, query, category } = await request.json();

    const workspace = getWorkspace(workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const allProfiles = getProfiles();
    const travelerProfiles = workspace.travelers
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const profiles = travelerProfiles.length > 0 ? travelerProfiles : [getProfile()];

    const searchId = uuidv4();
    const rawResults = await searchAndScore(query, category as SearchCategory, searchId, profiles);
    const scoredResults = attachTravelerScores(rawResults, travelerProfiles);

    const search: Search = {
      id: searchId,
      workspaceId,
      query,
      category: category as SearchCategory,
      rawResults: [],
      scoredResults,
      searchedAt: new Date().toISOString(),
    };

    workspace.searches.unshift(search);
    saveWorkspace(workspace);

    return NextResponse.json(search);
  } catch (e) {
    console.error("Search error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
