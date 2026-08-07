export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const { searchAndScore } = await import("@/lib/gemini");
    results.gemini_import = "ok";

    const fakeProfile = {
      id: "test",
      name: "Test",
      enneagramType: "4" as const,
      description: "",
      axisWeights: {
        calm: 0.5, designSincerity: 0.5, valueIntegrity: 0.5,
        socialPermeability: 0.5, autonomy: 0.5, novelty: 0.5, locationFriction: 0.5,
      },
      thresholds: {},
      dealbreakers: [],
      isDefault: true,
    };

    const res = await searchAndScore(
      "boutique hotel",
      "accommodation",
      "test-search-id",
      [fakeProfile],
      "Tuscany",
      undefined,
      undefined,
      true // skipCache
    );
    results.searchAndScore = `ok: ${res.length} results`;
  } catch (e) {
    results.searchAndScore = `ERROR: ${e instanceof Error ? e.message.slice(0, 400) : String(e)}`;
  }

  return NextResponse.json(results);
}
