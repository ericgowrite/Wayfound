import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  } else {
    // On Cloud Run, fall back to Application Default Credentials.
    // Explicitly passing the projectId ensures the Admin SDK targets the
    // correct Firebase project even when credentials are inferred from ADC.
    initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
adminDb.settings({ ignoreUndefinedProperties: true });
