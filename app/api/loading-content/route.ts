import { NextResponse } from "next/server";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { generateLoadingContent } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    await getTokenClaims(request);
    const { destination, category, travelers } = await request.json();

    if (!destination || !category || !Array.isArray(travelers)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const items = await generateLoadingContent({ destination, category, travelers });
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Non-fatal — client falls back to static copy
    console.error("[loading-content] error:", e);
    return NextResponse.json({ items: [] });
  }
}
