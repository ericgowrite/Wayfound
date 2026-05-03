import { NextResponse } from "next/server";
import { getWorkspaces, saveWorkspace, getProfile } from "@/lib/storage";
import { TripWorkspace } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const workspaces = getWorkspaces();
    return NextResponse.json(workspaces);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspace: TripWorkspace = {
      id: uuidv4(),
      name: body.name,
      destination: body.destination || "",
      dates: body.dates,
      travelers: body.travelers?.length ? body.travelers : [getProfile().id],
      searches: [],
      savedOptions: [],
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveWorkspace(workspace);
    return NextResponse.json(workspace);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
