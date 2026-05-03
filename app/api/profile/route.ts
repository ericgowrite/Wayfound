import { NextResponse } from "next/server";
import { getProfile, saveProfileToList } from "@/lib/storage";

// Legacy single-profile endpoint — returns the default profile
export async function GET() {
  try {
    return NextResponse.json(getProfile());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await request.json();
    saveProfileToList(profile);
    return NextResponse.json(profile);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
