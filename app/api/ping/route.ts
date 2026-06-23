export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({
    ok: true,
    // K_REVISION is the Cloud Run revision name (auto-set by GCP)
    build: process.env.K_REVISION ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
    ts: Date.now(),
  });
}
