export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

  results.project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "missing";
  results.googleApiKey = process.env.GOOGLE_API_KEY ? "set" : "MISSING";
  results.buildCommit = process.env.BUILD_COMMIT ?? "unknown";
  results.firestoreStatus = "skipped";
  results.authStatus = "skipped";

  try {
    const { adminDb } = await import("@/lib/firebase-admin");
    await adminDb.collection("_health").limit(1).get();
    results.firestoreStatus = "ok";
  } catch (e) {
    results.firestoreStatus = `ERROR: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`;
  }

  // Test 3.6-flash with googleSearch + thinkingConfig (mirrors actual search call)
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: { thinkingConfig: { thinkingBudget: 1024 } } as any,
    });
    const result = await model.generateContent("Say OK in one word.");
    results.gemini_3_6_flash_search = `ok: ${result.response.text().slice(0, 50)}`;
  } catch (e) {
    results.gemini_3_6_flash_search = `ERROR: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`;
  }

  // Test 3.5-flash-lite plain (mirrors loading-content/chat)
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
    const result = await model.generateContent("Say OK in one word.");
    results.gemini_3_5_flash_lite = `ok: ${result.response.text().slice(0, 50)}`;
  } catch (e) {
    results.gemini_3_5_flash_lite = `ERROR: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`;
  }

  return NextResponse.json(results);
}
