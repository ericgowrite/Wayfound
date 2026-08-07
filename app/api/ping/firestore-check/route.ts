export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, string> = {};

  results.project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "missing";
  results.googleApiKey = process.env.GOOGLE_API_KEY ? "set" : "MISSING";

  try {
    const { adminDb } = await import("@/lib/firebase-admin");
    await adminDb.collection("_health").limit(1).get();
    results.firestore = "ok";
  } catch (e) {
    results.firestore = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { adminAuth } = await import("@/lib/firebase-admin");
    await adminAuth.listUsers(1);
    results.auth = "ok";
  } catch (e) {
    results.auth = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const apiKey = process.env.GOOGLE_API_KEY!;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Say OK in one word.");
    results.gemini = `ok: ${result.response.text().slice(0, 30)}`;
  } catch (e) {
    results.gemini = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(results);
}
