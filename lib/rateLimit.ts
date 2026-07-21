/**
 * Per-user Gemini call rate limiter backed by Firestore.
 *
 * Tracks how many Gemini-backed API calls a user has made in the current
 * 1-hour window. Anonymous users share a tighter cap. Returns { allowed: boolean }.
 *
 * Firestore path: userRateLimits/{userId}
 * Document fields: count (number), windowStart (ISO string)
 */

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_CALLS_AUTHED = 40;
const MAX_CALLS_ANON = 6; // anon already has a 2-search hard cap; this is a safety net

interface RateLimitDoc {
  count: number;
  windowStart: string;
}

export async function checkRateLimit(
  userId: string,
  isAnonymous: boolean
): Promise<{ allowed: boolean; remaining: number }> {
  const max = isAnonymous ? MAX_CALLS_ANON : MAX_CALLS_AUTHED;
  const ref = adminDb.collection("userRateLimits").doc(userId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();

      if (!snap.exists) {
        tx.set(ref, { count: 1, windowStart: new Date(now).toISOString() });
        return { allowed: true, remaining: max - 1 };
      }

      const data = snap.data() as RateLimitDoc;
      const windowStart = new Date(data.windowStart).getTime();

      // Window expired — reset
      if (now - windowStart >= WINDOW_MS) {
        tx.set(ref, { count: 1, windowStart: new Date(now).toISOString() });
        return { allowed: true, remaining: max - 1 };
      }

      if (data.count >= max) {
        return { allowed: false, remaining: 0 };
      }

      tx.update(ref, { count: FieldValue.increment(1) });
      return { allowed: true, remaining: max - data.count - 1 };
    });

    return result;
  } catch {
    // Rate limit check failure is non-fatal — allow the request through
    // rather than blocking legitimate users on a Firestore hiccup.
    return { allowed: true, remaining: max };
  }
}
