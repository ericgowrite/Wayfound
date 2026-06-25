"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  signInAnonymously,
  linkWithPopup,
  linkWithCredential,
  signOut,
  GoogleAuthProvider,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, googleProvider } from "./firebase";
import { fetchWithAuth } from "./fetchWithAuth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True when the current session is anonymous (not yet signed up / signed in). */
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureUserDoc(user: User) {
  const db = getFirebaseDb();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      userId: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
      profiles: [],
      workspaces: [],
    });
  }
}

/**
 * Server-side merge: copies all Firestore data from the anonymous UID into the
 * now-authenticated real account, then deletes the anonymous data.
 * Non-fatal: if this fails the user is already signed in; orphaned anon data
 * will be cleaned up by the scheduled cleanup job.
 */
async function mirrorTourFlagsToFirestore(uid: string) {
  const db = getFirebaseDb();
  const ref = doc(db, "users", uid, "config", "preferences");
  const updates: Record<string, boolean> = {};
  if (typeof window !== "undefined") {
    if (localStorage.getItem("vw_tour_dashboard") === "1") updates.tourDashboardDone = true;
    if (localStorage.getItem("vw_tour_workspace") === "1") updates.tourWorkspaceDone = true;
  }
  if (Object.keys(updates).length > 0) {
    await setDoc(ref, updates, { merge: true }).catch(() => {});
  }
}

async function mergeAnonData(anonUid: string) {
  try {
    await fetchWithAuth("/api/merge-anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonUid }),
    });
  } catch {
    console.warn("[AuthContext] merge-anonymous failed — anon data will be cleaned up later");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u === null) {
        // No session at all — start a silent anonymous one.
        // The next onAuthStateChanged call will deliver the anonymous user.
        signInAnonymously(auth).catch(() => {
          // If anonymous sign-in fails (network offline etc.), unblock the UI.
          setLoading(false);
        });
        return; // don't setLoading(false) yet — wait for the anon user event
      }
      setUser(u);
      // Only create a Firestore user doc for real (non-anonymous) users.
      if (!u.isAnonymous) {
        try { await ensureUserDoc(u); } catch {}
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  /**
   * Sign in with email + password.
   * If the current session is anonymous, the anonymous data is merged into the
   * real account after sign-in (the UID changes, triggering a dashboard remount).
   */
  async function signIn(email: string, password: string) {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    const anonUid = current?.isAnonymous ? current.uid : null;

    await signInWithEmailAndPassword(auth, email, password);

    // After signInWithEmailAndPassword, auth.currentUser is the real user.
    if (anonUid && auth.currentUser?.uid !== anonUid) {
      await mergeAnonData(anonUid);
    }
    if (auth.currentUser) await mirrorTourFlagsToFirestore(auth.currentUser.uid);
  }

  /**
   * Create a new account.
   * If the current session is anonymous, we upgrade it via linkWithCredential
   * (same UID preserved — no data migration needed). If the email already exists,
   * Firebase throws auth/email-already-in-use and we surface that to the caller.
   */
  async function signUp(email: string, password: string) {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;

    if (current?.isAnonymous) {
      // Upgrade path: link the anon account → same UID, all data preserved.
      const credential = EmailAuthProvider.credential(email, password);
      const cred = await linkWithCredential(current, credential);
      try { await ensureUserDoc(cred.user); } catch {}
      await mirrorTourFlagsToFirestore(cred.user.uid);
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try { await ensureUserDoc(cred.user); } catch {}
      await mirrorTourFlagsToFirestore(cred.user.uid);
    }
  }

  /**
   * Sign in / sign up with Google.
   * If anonymous: tries to link first (happy path, same UID).
   * If the Google account already exists: signs in with it and merges anon data.
   */
  async function signInWithGoogle() {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;

    if (current?.isAnonymous) {
      const anonUid = current.uid;
      try {
        // Happy path: Google account is new → link → same UID preserved.
        const cred = await linkWithPopup(current, googleProvider);
        try { await ensureUserDoc(cred.user); } catch {}
        await mirrorTourFlagsToFirestore(cred.user.uid);
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "auth/credential-already-in-use") {
          // Existing Google account — sign in with it, then merge anon data.
          const credential = GoogleAuthProvider.credentialFromError(
            err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
          );
          if (!credential) throw err;
          const cred = await signInWithCredential(auth, credential);
          try { await ensureUserDoc(cred.user); } catch {}
          if (cred.user.uid !== anonUid) {
            await mergeAnonData(anonUid);
          }
          await mirrorTourFlagsToFirestore(cred.user.uid);
        } else {
          throw err;
        }
      }
    } else {
      const cred = await signInWithPopup(auth, googleProvider);
      try { await ensureUserDoc(cred.user); } catch {}
    }
  }

  async function logout() {
    const auth = getFirebaseAuth();
    await signOut(auth);
    // onAuthStateChanged will fire with null → signInAnonymously() starts a
    // fresh anonymous session automatically.
  }

  const isAnonymous = user?.isAnonymous ?? false;

  return (
    <AuthContext.Provider value={{ user, loading, isAnonymous, signIn, signUp, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
