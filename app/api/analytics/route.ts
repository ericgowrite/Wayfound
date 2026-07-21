export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

const ANALYTICS_TTL_DAYS = 30;

// Prune analytics events older than 30 days for this user.
// Runs probabilistically (1-in-20 chance) so it fires in the background
// without adding latency to every event write.
async function maybePruneAnalytics(userId: string): Promise<void> {
  if (Math.random() > 0.05) return;
  try {
    const cutoff = Timestamp.fromMillis(
      Date.now() - ANALYTICS_TTL_DAYS * 24 * 60 * 60 * 1000
    );
    const old = await adminDb
      .collection("users")
      .doc(userId)
      .collection("analytics")
      .where("ts", "<", cutoff.toDate().toISOString())
      .limit(100)
      .get();
    if (old.empty) return;
    const batch = adminDb.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch {
    // non-fatal
  }
}

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

    // Fire-and-forget — don't await, don't block the response
    void maybePruneAnalytics(userId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[analytics] write failed:", e);
    // Non-fatal — return 200 so client never retries analytics failures
    return NextResponse.json({ ok: true });
  }
}
