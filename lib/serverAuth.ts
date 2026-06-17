import { adminAuth } from "@/lib/firebase-admin";

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthError";
  }
}

/**
 * Extract and verify the Firebase ID token from the Authorization header.
 * Returns the caller's UID. Throws AuthError if missing or invalid.
 */
export async function getUserId(request: Request): Promise<string> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) throw new AuthError();
  const decoded = await adminAuth.verifyIdToken(header.slice(7));
  return decoded.uid;
}
