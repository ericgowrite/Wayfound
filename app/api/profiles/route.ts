export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getProfiles, saveProfileToList } from "@/lib/storage";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { friendlyError } from "@/lib/errorMessages";
import { Profile } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: Request) {
  try {
    const userId = await getUserId(request);
    const profiles = await getProfiles(userId);
    console.log(`[profiles GET] uid=${userId} count=${profiles.length}`);
    const res = NextResponse.json(profiles);
    res.headers.set("Cache-Control", "no-store, private");
    return res;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[profiles GET] error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const profile: Profile = {
      id: uuidv4(),
      name: body.name,
      enneagramType: body.enneagramType,
      description: body.description ?? "",
      axisWeights: body.axisWeights,
      thresholds: body.thresholds ?? {},
      dealbreakers: body.dealbreakers ?? [],
      isDefault: false,
    };
    await saveProfileToList(userId, profile);
    return NextResponse.json(profile);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[profiles POST] error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
