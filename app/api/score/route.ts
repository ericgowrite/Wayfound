import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, getWorkspaces, saveWorkspace } from "@/lib/storage";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { scoreSpecific, extractUserUrl } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { friendlyError } from "@/lib/errorMessages";
import { validateOrFallback } from "@/lib/urlCheck";
import { checkRateLimit } from "@/lib/rateLimit";
import { Search, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

const VALID_CATEGORIES: SearchCategory[] = ["accommodation", "tour", "restaurant", "activity", "attraction"];

const ANON_SEARCH_LIMIT = 2;

export async function POST(request: Request) {
  try {
    const { uid: userId, isAnonymous } = await getTokenClaims(request);
    const { workspaceId, input, category } = await request.json();

    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    if (!input?.trim()) {
      return NextResponse.json({ error: "Input cannot be empty" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category as SearchCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

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

    const { allowed } = await checkRateLimit(userId, isAnonymous);
    if (!allowed) {
      return NextResponse.json(
        { error: "You're searching fast — give it a minute and try again.", code: "RATE_LIMIT" },
        { status: 429 }
      );
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

    const raw = await scoreSpecific(input, category as SearchCategory, searchId, profiles, workspace.destination, workspace.dates, workspace.partySize);

    // Sacred Rule 1: never replace a URL the user explicitly provided — only
    // validate/fall-back on AI-found sources.
    const isUserProvidedUrl = input.trim().startsWith("http") || !!extractUserUrl(input);
    if (!isUserProvidedUrl) {
      raw.source = await validateOrFallback(raw.source, raw.name, workspace.destination, workspace.dates, workspace.partySize);
    }

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
