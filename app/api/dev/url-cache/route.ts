import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

if (process.env.NODE_ENV === "production") {
  // Belt-and-suspenders: middleware already blocks /api/dev/* in prod,
  // but the route itself also refuses to run.
}

function guard() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  return null;
}

// GET /api/dev/url-cache?limit=100
// Returns all cached URL validation entries, newest first.
export async function GET(request: Request) {
  const g = guard(); if (g) return g;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);
  const filterDomain = searchParams.get("domain") ?? "";

  const col = adminDb.collection("urlValidationCache");
  const snap = filterDomain
    ? await col.where("domain", "==", filterDomain).limit(1).get()
    : await col.orderBy("lastChecked", "desc").limit(limit).get();

  const entries = snap.docs.map((d) => {
    const data = d.data();
    return {
      domain: d.id,
      isValid: data.isValid,
      finalUrl: data.finalUrl ?? null,
      reason: data.reason ?? null,
      lastChecked: data.lastChecked?.toDate?.()?.toISOString() ?? null,
      expiresAt: data.expiresAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ count: entries.length, entries });
}

// DELETE /api/dev/url-cache?domain=hotelelroblar.com
// Evicts a specific domain from the cache so it gets re-validated on next search.
export async function DELETE(request: Request) {
  const g = guard(); if (g) return g;

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain")?.replace(/^www\./, "");
  if (!domain) {
    return NextResponse.json({ error: "domain query param required" }, { status: 400 });
  }

  await adminDb.collection("urlValidationCache").doc(domain).delete();
  return NextResponse.json({ ok: true, evicted: domain });
}

// POST /api/dev/url-cache/evict-invalid
// Bulk-evict all entries where isValid === false or reason === "content_mismatch".
export async function POST(request: Request) {
  const g = guard(); if (g) return g;

  const body = await request.json().catch(() => ({}));
  const mode: string = body.mode ?? "invalid";

  const col = adminDb.collection("urlValidationCache");
  let snap;
  if (mode === "all") {
    snap = await col.limit(500).get();
  } else {
    snap = await col.where("isValid", "==", false).limit(500).get();
  }

  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  return NextResponse.json({ ok: true, evicted: snap.size, mode });
}
