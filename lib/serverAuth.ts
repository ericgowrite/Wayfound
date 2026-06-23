import { adminAuth } from "@/lib/firebase-admin";

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthError";
  }
}

export interface TokenClaims {
  uid: string;
  /** True when the caller is an anonymous Firebase user (not yet signed up). */
  isAnonymous: boolean;
}

/**
 * Verify the Firebase ID token and return full claims including anonymous status.
 * Anonymous users have a valid token but sign_in_provider === "anonymous".
 */
export async function getTokenClaims(request: Request): Promise<TokenClaims> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new AuthError();
  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    const isAnonymous = decoded.firebase?.sign_in_provider === "anonymous";
    console.log(`[serverAuth] uid=${decoded.uid} anon=${isAnonymous} email=${decoded.email ?? "n/a"}`);
    return { uid: decoded.uid, isAnonymous };
  } catch {
    throw new AuthError();
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
  const { uid } = await getTokenClaims(request);
  return uid;
}
