import { NextResponse } from "next/server";
import { getProfile } from "@/lib/storage";
import { generateDeepDive } from "@/lib/gemini";
import { ScoredOption } from "@/types";

export async function POST(request: Request) {
  try {
    const { option } = await request.json() as { option: ScoredOption };
    const profile = getProfile();
    const analysis = await generateDeepDive(option, profile);
    return NextResponse.json({ analysis });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
