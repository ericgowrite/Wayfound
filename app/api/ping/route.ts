export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({ ok: true, build: "a0da453", ts: Date.now() });
}
