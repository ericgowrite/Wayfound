import { getFirebaseAuth } from "@/lib/firebase";

/**
 * Drop-in replacement for fetch() that automatically attaches the current
 * user's Firebase ID token as an Authorization header. Use this for every
 * API call from client components so server routes can identify the caller.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = getFirebaseAuth().currentUser;
  const token = user ? await user.getIdToken() : null;
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
