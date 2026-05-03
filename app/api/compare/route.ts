import { NextResponse } from "next/server";
import { getProfile } from "@/lib/storage";
import { generateComparison } from "@/lib/claude";
import { ScoredOption } from "@/types";

export async function POST(request: Request) {
  try {
    const { options } = await request.json() as { options: ScoredOption[] };
    const profile = getProfile();
    const summary = await generateComparison(options, profile);
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
