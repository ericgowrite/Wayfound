export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getProfile, saveProfileToList } from "@/lib/storage";
import { getUserId, AuthError } from "@/lib/serverAuth";

export async function GET(request: Request) {
  try {
    const userId = await getUserId(request);
    return NextResponse.json(await getProfile(userId));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getUserId(request);
    const profile = await request.json();
    await saveProfileToList(userId, profile);
    return NextResponse.json(profile);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
