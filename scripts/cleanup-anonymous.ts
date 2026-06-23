/**
 * Cleanup script for orphaned anonymous Firebase data.
 *
 * Firebase Auth auto-deletes anonymous accounts after 30 days of inactivity,
 * but their Firestore data (profiles, workspaces) is NOT auto-deleted.
 * This script finds anonymous accounts older than 30 days and deletes their
 * Firestore documents.
 *
 * Run manually or schedule via Cloud Scheduler → a Cloud Run cron endpoint.
 *
 * Usage (run from repo root, requires GOOGLE_APPLICATION_CREDENTIALS or ADC):
 *   npx ts-node --project tsconfig.json scripts/cleanup-anonymous.ts
 *
 * To automate: add a POST /api/cron/cleanup-anonymous route protected by a
 * CRON_SECRET env var and schedule it with Cloud Scheduler monthly.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS as string) });
}

const auth = getAuth();
const db = getFirestore();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function cleanupAnonymousUsers() {
  let totalDeleted = 0;
  let pageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    pageToken = result.pageToken;

    for (const user of result.users) {
      if (!user.providerData.length && user.metadata.creationTime) {
        const age = Date.now() - new Date(user.metadata.creationTime).getTime();
        if (age >= THIRTY_DAYS_MS) {
          // Delete Firestore data
          await db.collection("users").doc(user.uid).collection("config").doc("profiles").delete().catch(() => {});
          const workspacesSnap = await db.collection("users").doc(user.uid).collection("workspaces").get();
          for (const doc of workspacesSnap.docs) {
            await doc.ref.delete();
          }
          // Delete Auth account
          await auth.deleteUser(user.uid).catch(() => {});
          console.log(`Deleted anonymous user ${user.uid} (age: ${Math.round(age / 86400000)}d)`);
          totalDeleted++;
        }
      }
    }
  } while (pageToken);

  console.log(`Done. Deleted ${totalDeleted} anonymous users.`);
}

cleanupAnonymousUsers().catch(console.error);
