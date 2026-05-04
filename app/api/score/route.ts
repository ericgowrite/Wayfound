import { NextResponse } from "next/server";
import { getProfile, getWorkspace, saveWorkspace } from "@/lib/storage";
import { scoreSpecific } from "@/lib/gemini";
import { Search, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const { workspaceId, input, category } = await request.json();

    const workspace = getWorkspace(workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const profile = getProfile(workspace.travelers[0]);
    const searchId = uuidv4();

    const result = await scoreSpecific(input, category as SearchCategory, searchId, profile);

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
    saveWorkspace(workspace);

    return NextResponse.json(search);
  } catch (e) {
    console.error("Score error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
