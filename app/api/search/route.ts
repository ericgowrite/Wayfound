import { NextResponse } from "next/server";
import { getProfile, getWorkspace, saveWorkspace } from "@/lib/storage";
import { searchAndScore } from "@/lib/gemini";
import { Search, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const { workspaceId, query, category } = await request.json();

    const workspace = getWorkspace(workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    // Use primary traveler's profile (first in list), fall back to default
    const profile = getProfile(workspace.travelers[0]);

    const searchId = uuidv4();
    const scoredResults = await searchAndScore(
      query,
      category as SearchCategory,
      searchId,
      profile
    );

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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
