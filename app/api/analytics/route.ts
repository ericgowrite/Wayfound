export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { adminDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const userId = await getUserId(request);
    const payload = await request.json();

    if (!payload?.event || typeof payload.event !== "string") {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }

    await adminDb
      .collection("users")
      .doc(userId)
      .collection("analytics")
      .doc(uuidv4())
      .set({ ...payload, ts: new Date().toISOString() });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[analytics] write failed:", e);
    // Non-fatal — return 200 so client never retries analytics failures
    return NextResponse.json({ ok: true });
  }
}
