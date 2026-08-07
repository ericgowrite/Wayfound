import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace, getWorkspaces, saveWorkspace } from "@/lib/storage";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { searchAndScore } from "@/lib/gemini";
import { attachTravelerScores } from "@/lib/scoring";
import { validateResultLinks } from "@/lib/urlCheck";
import { friendlyError } from "@/lib/errorMessages";
import { checkRateLimit } from "@/lib/rateLimit";
import { Search, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { logSearchHistory, getRecentWorkspaceSearches, getWorkspaceWeights } from "@/lib/behaviorLog";
import { getEffectiveWeights } from "@/lib/behaviorNudge";

const VALID_CATEGORIES: SearchCategory[] = ["accommodation", "tour", "restaurant", "activity", "attraction"];

/** Anonymous users get 1 free search across all their workspaces. */
const ANON_SEARCH_LIMIT = 1;

export async function POST(request: Request) {
  let step = "init";
  try {
    step = "auth";
    const { uid: userId, isAnonymous } = await getTokenClaims(request);
    step = "parse";
    const { workspaceId, query, category, intent } = await request.json();
    console.log(`[search] parsed uid=${userId} ws=${workspaceId} q="${query}" cat=${category}`);

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
      step = "anonCheck";
      const allWorkspaces = await getWorkspaces(userId);
      const totalSearches = allWorkspaces.reduce((n, w) => n + w.searches.length, 0);
      if (totalSearches >= ANON_SEARCH_LIMIT) {
        return NextResponse.json(
          { error: "Sign in to keep searching.", code: "ANON_LIMIT" },
          { status: 403 }
        );
      }
    }

    step = "rateLimit";
    const { allowed } = await checkRateLimit(userId, isAnonymous);
    if (!allowed) {
      return NextResponse.json(
        { error: "You're searching fast — give it a minute and try again.", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    step = "getWorkspace";
    const workspace = await getWorkspace(userId, workspaceId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    step = "getProfiles";
    const allProfiles = await getProfiles(userId);
    const travelerProfiles = workspace.travelers
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    step = "getDefaultProfile";
    const defaultProfile = await getProfile(userId);
    const profiles = travelerProfiles.length > 0 ? travelerProfiles : (defaultProfile ? [defaultProfile] : []);

    if (profiles.length === 0) {
      return NextResponse.json({ error: "No traveler profile found. Please complete your travel style assessment first." }, { status: 400 });
    }

    const primaryProfile = profiles[0];
    const searchId = uuidv4();
    console.log(`[search] profiles=${profiles.length} primaryProfile=${primaryProfile.id} searchId=${searchId}`);

    step = "effectiveWeights";
    // Build effective profiles with workspace-scoped weights when enough signal exists.
    const effectiveProfiles = await Promise.all(
      profiles.map(async (p) => {
        const wsWeights = await getWorkspaceWeights(userId, p.id, workspaceId);
        const effective = getEffectiveWeights(p.axisWeights, wsWeights);
        return { ...p, axisWeights: effective };
      })
    );

    step = "recentSearches";
    // Fetch recent workspace searches for Gemini context (best-effort — non-blocking).
    const recentSearches = primaryProfile
      ? await getRecentWorkspaceSearches(userId, primaryProfile.id, workspaceId, 5).catch(() => [])
      : [];

    step = "searchAndScore";
    console.log(`[search] calling searchAndScore step=${step}`);
    const rawResults = await searchAndScore(
      query,
      category as SearchCategory,
      searchId,
      effectiveProfiles,
      workspace.destination,
      workspace.dates,
      workspace.partySize,
      false,
      typeof intent === "string" ? intent : undefined,
      recentSearches
    );
    console.log(`[search] searchAndScore done results=${rawResults.length}`);

    step = "validateLinks";
    const validatedResults = await validateResultLinks(rawResults, workspace.destination, workspace.dates, workspace.partySize);
    step = "attachScores";
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

    step = "saveWorkspace";
    workspace.searches.unshift(search);
    await saveWorkspace(userId, workspace);

    // Log to search history for personalization context (best-effort — fire-and-forget).
    if (!isAnonymous && primaryProfile) {
      void logSearchHistory(userId, primaryProfile.id, {
        id: searchId,
        query,
        workspaceId,
        timestamp: search.searchedAt,
      }).catch(() => {});
    }

    return NextResponse.json(search);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(`[search] error at step=${step}:`, e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
