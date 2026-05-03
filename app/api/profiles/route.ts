import { NextResponse } from "next/server";
import { getProfiles, saveProfileToList } from "@/lib/storage";
import { Profile } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    return NextResponse.json(getProfiles());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
    saveProfileToList(profile);
    return NextResponse.json(profile);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
