import { NextResponse } from "next/server";
import { getTokenClaims, AuthError } from "@/lib/serverAuth";
import { createAssessLink } from "@/lib/assessLink";

export async function POST(request: Request) {
  try {
    const { uid: userId, isAnonymous } = await getTokenClaims(request);
    if (isAnonymous) return NextResponse.json({ error: "Sign in to send an assessment link" }, { status: 401 });

    const { workspaceId } = await request.json();
    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const record = await createAssessLink(userId, workspaceId);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://viyaway.com";
    const url = `${baseUrl}/assess/${record.token}`;

    return NextResponse.json({ token: record.token, url });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[assess-link] create error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
