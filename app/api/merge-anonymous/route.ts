import { NextResponse } from "next/server";
import { getUserId, AuthError } from "@/lib/serverAuth";
import { getProfiles, getWorkspaces, saveProfileToList, saveWorkspace, deleteWorkspace } from "@/lib/storage";
import { adminDb } from "@/lib/firebase-admin";
import { friendlyError } from "@/lib/errorMessages";

/**
 * POST /api/merge-anonymous
 *
 * Copies all Firestore data (profiles + workspaces) from an anonymous UID into
 * the currently authenticated (real) user's account, then deletes the anonymous
 * data. Called by AuthContext after a successful sign-in/sign-up that replaces
 * an anonymous session with a different real UID.
 *
 * Body: { anonUid: string }
 * Auth: must be a real (non-anonymous) user — their token provides the target UID.
 */
export async function POST(request: Request) {
  try {
    const realUid = await getUserId(request);
    const { anonUid } = await request.json();

    if (!anonUid || typeof anonUid !== "string") {
      return NextResponse.json({ error: "anonUid required" }, { status: 400 });
    }
    // Guard: never merge a user into themselves
    if (anonUid === realUid) {
      return NextResponse.json({ ok: true, skipped: "same user" });
    }

    // ── Copy profiles ──────────────────────────────────────────────────────
    const anonProfiles = await getProfiles(anonUid);
    const realProfiles = await getProfiles(realUid);
    const realNames = new Set(realProfiles.map((p) => p.name.trim().toLowerCase()));
    for (const profile of anonProfiles) {
      // Skip if the real account already has a profile with the same name
      // (avoids duplicates when a user completes onboarding anonymously then logs in)
      if (realNames.has(profile.name.trim().toLowerCase())) continue;
      await saveProfileToList(realUid, profile);
    }

    // ── Copy workspaces ────────────────────────────────────────────────────
    const anonWorkspaces = await getWorkspaces(anonUid);
    for (const workspace of anonWorkspaces) {
      await saveWorkspace(realUid, workspace);
    }

    // ── Delete anonymous Firestore data ────────────────────────────────────
    await adminDb
      .collection("users")
      .doc(anonUid)
      .collection("config")
      .doc("profiles")
      .delete();
    for (const workspace of anonWorkspaces) {
      await deleteWorkspace(anonUid, workspace.id);
    }

    console.log(
      `[merge-anonymous] anon=${anonUid} → real=${realUid}: ` +
        `${anonProfiles.length} profiles, ${anonWorkspaces.length} workspaces`
    );
    return NextResponse.json({
      ok: true,
      mergedProfiles: anonProfiles.length,
      mergedWorkspaces: anonWorkspaces.length,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Merge anonymous error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
