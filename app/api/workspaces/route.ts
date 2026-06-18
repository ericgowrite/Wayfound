export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWorkspaces, saveWorkspace, getProfile } from "@/lib/storage";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { TripWorkspace } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: Request) {
  try {
    const userId = await getUserId();
    return NextResponse.json(await getWorkspaces(userId));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    const body = await request.json();
    const defaultProfile = await getProfile(userId);
    const workspace: TripWorkspace = {
      id: uuidv4(),
      name: body.name,
      destination: body.destination || "",
      dates: body.dates,
      travelers: body.travelers?.length ? body.travelers : [defaultProfile?.id].filter(Boolean),
      searches: [],
      savedOptions: [],
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveWorkspace(userId, workspace);
    return NextResponse.json(workspace);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
