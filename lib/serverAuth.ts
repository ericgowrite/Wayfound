import { adminAuth } from "@/lib/firebase-admin";

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthError";
  }
}

/**
 * Extract and verify the Firebase ID token from the incoming Request object.
 * Reads directly from request.headers — NOT from next/headers — to avoid the
 * async-context leak that can occur between concurrent requests on Cloud Run,
 * where headers() from next/headers may return headers belonging to a
 * different in-flight request.
 * Returns the caller's UID. Throws AuthError if missing or invalid.
 */
export async function getUserId(request: Request): Promise<string> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new AuthError();
  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    console.log(`[serverAuth] uid=${decoded.uid} email=${decoded.email ?? "n/a"}`);
    return decoded.uid;
  } catch {
    throw new AuthError();
  }
}
