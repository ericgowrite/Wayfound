import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/storage";

export async function GET() {
  try {
    const profile = getProfile();
    return NextResponse.json(profile);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await request.json();
    saveProfile(profile);
    return NextResponse.json(profile);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
