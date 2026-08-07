export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

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

  // List available models for this API key
  try {
    const apiKey = process.env.GOOGLE_API_KEY!;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    const generateModels = (data.models ?? [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name);
    results.availableModels = generateModels;
  } catch (e) {
    results.availableModels = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(results);
}
