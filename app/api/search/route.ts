import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, getWorkspaces, saveWorkspace } from "@/lib/storage";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { searchAndScore } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { friendlyError } from "@/lib/errorMessages";
import { validateResultLinks } from "@/lib/urlCheck";
import { Search, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

const VALID_CATEGORIES: SearchCategory[] = ["accommodation", "tour", "restaurant", "activity", "attraction"];

/** Anonymous users get 2 free searches across all their workspaces. */
const ANON_SEARCH_LIMIT = 2;

export async function POST(request: Request) {
  try {
    const { uid: userId, isAnonymous } = await getTokenClaims(request);
    const { workspaceId, query, category } = await request.json();

    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    if (!query?.trim()) {
      return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category as SearchCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Enforce free-tier search limit for anonymous users before touching Gemini.
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

    const allProfiles = await getProfiles(userId);
    const travelerProfiles = workspace.travelers
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const defaultProfile = await getProfile(userId);
    const profiles = travelerProfiles.length > 0 ? travelerProfiles : (defaultProfile ? [defaultProfile] : []);

    const searchId = uuidv4();
    const rawResults = await searchAndScore(query, category as SearchCategory, searchId, profiles, workspace.destination, workspace.dates, workspace.partySize);
    // Validate every link before it's ever shown to the user — no result
    // should reach the client with a known-broken source (MVP backlog #4).
    const validatedResults = await validateResultLinks(rawResults, workspace.destination, workspace.dates, workspace.partySize);
    const scoredResults = attachTravelerScores(validatedResults, travelerProfiles);

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
    await saveWorkspace(userId, workspace);

    return NextResponse.json(search);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Search error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
