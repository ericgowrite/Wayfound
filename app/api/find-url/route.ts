import { NextResponse } from "next/server";
import { getTokenClaims } from "@/lib/serverAuth";

/**
 * Find a replacement URL for a named result using the Google Places API.
 *
 * POST body: { name: string; category?: string; destination?: string }
 * Response:  { url: string | null }
 *
 * Uses findplacefromtext with the `website` field — one API call, no chaining.
 * Returns null on any failure so callers can degrade gracefully.
 */
export async function POST(request: Request) {
  try {
    await getTokenClaims(request);
  } catch {
    return NextResponse.json({ url: null }, { status: 401 });
  }

  let name: string;
  let category: string | undefined;
  let destination: string | undefined;

  try {
    ({ name, category, destination } = await request.json());
  } catch {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("[find-url] GOOGLE_API_KEY not set");
    return NextResponse.json({ url: null });
  }

  // Build the query: place name + destination gives the best match accuracy.
  // Optionally append category type hint (e.g., "restaurant") to disambiguate.
  const queryParts = [name.trim()];
  if (destination?.trim()) queryParts.push(destination.trim());
  if (category && category !== "attraction") queryParts.push(category);
  const input = queryParts.join(" ");

  const params = new URLSearchParams({
    input,
    inputtype: "textquery",
    fields: "website,name",
    key: apiKey,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) {
      console.warn("[find-url] Places API returned", res.status);
      return NextResponse.json({ url: null });
    }

    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[find-url] Places API status:", data.status);
    }

    const website: string | null = data.candidates?.[0]?.website ?? null;
    return NextResponse.json({ url: website });
  } catch (err) {
    console.error("[find-url] fetch error:", err);
    return NextResponse.json({ url: null });
  }
}
