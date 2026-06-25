"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { useAuth } from "./AuthContext";

export type TourKey = "dashboard" | "workspace";

function lsKey(key: TourKey) { return `vw_tour_${key}`; }
function fsField(key: TourKey) { return key === "dashboard" ? "tourDashboardDone" : "tourWorkspaceDone"; }

export function useTourState(key: TourKey): {
  isDone: boolean;
  markDone: () => Promise<void>;
} {
  const { user, isAnonymous, loading } = useAuth();
  // Start true so the tour never flashes before the async check completes.
  const [isDone, setIsDone] = useState(true);

  useEffect(() => {
    if (loading) return; // wait for auth to resolve

    async function check() {
      const local = typeof window !== "undefined" && localStorage.getItem(lsKey(key)) === "1";

      if (!user || isAnonymous) {
        setIsDone(local);
        return;
      }

      // Signed-in user: check Firestore (takes precedence)
      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid, "config", "preferences");
        const snap = await getDoc(ref);
        const fsValue = snap.exists() ? snap.data()?.[fsField(key)] === true : false;

        if (fsValue && !local && typeof window !== "undefined") {
          localStorage.setItem(lsKey(key), "1");
        }
        setIsDone(local || fsValue);
      } catch {
        setIsDone(local);
      }
    }

    check();
  }, [key, user, isAnonymous, loading]);

  async function markDone() {
    if (typeof window !== "undefined") {
      localStorage.setItem(lsKey(key), "1");
    }
    setIsDone(true);

    if (user && !isAnonymous) {
      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid, "config", "preferences");
        await setDoc(ref, { [fsField(key)]: true }, { merge: true });
      } catch {
        // Non-fatal: localStorage is the source of truth for anon users
      }
    }
  }

  return { isDone, markDone };
}
