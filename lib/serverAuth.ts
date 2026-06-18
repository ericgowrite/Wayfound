import { headers } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthError";
  }
}

/**
 * Extract and verify the Firebase ID token from the Authorization header.
 * Uses next/headers so every route calling this is automatically dynamic
 * (never statically pre-rendered by Next.js at build time).
 * Returns the caller's UID. Throws AuthError if missing or invalid.
 */
export async function getUserId(): Promise<string> {
  const h = await headers();
  const authorization = h.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new AuthError();
  const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
  return decoded.uid;
}
