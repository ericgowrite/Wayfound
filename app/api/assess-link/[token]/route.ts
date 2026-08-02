import { NextResponse } from "next/server";
import { getAssessLink, markAssessLinkCompleted } from "@/lib/assessLink";
import { saveProfileToList, getWorkspace, saveWorkspace } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import { Profile } from "@/types";
import templates from "@/src/data/profileTemplates.json";
import { ProfileTemplate } from "@/types";

const TEMPLATES = templates as ProfileTemplate[];

// GET — validate a token (public, no auth)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const record = await getAssessLink(token);

  if (!record) {
    return NextResponse.json({ valid: false, reason: "not_found" }, { status: 404 });
  }
  if (record.status === "completed") {
    return NextResponse.json({ valid: false, reason: "already_used" });
  }
  if (new Date(record.expiresAt) < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  return NextResponse.json({ valid: true, expiresAt: record.expiresAt });
}

// POST — submit completed assessment (public, token-gated)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const record = await getAssessLink(token);
  if (!record) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (record.status === "completed") return NextResponse.json({ error: "This link has already been used" }, { status: 409 });
  if (new Date(record.expiresAt) < new Date()) return NextResponse.json({ error: "This link has expired" }, { status: 410 });

  const body = await request.json();
  const { name, enneagramType, axisWeights, thresholds, dealbreakers, pastTripContext } = body;

  if (!name?.trim() || !enneagramType || !axisWeights) {
    return NextResponse.json({ error: "Incomplete assessment data" }, { status: 400 });
  }

  // Build the profile — use template defaults for any missing fields
  const tmpl = TEMPLATES.find((t) => t.type === String(enneagramType));
  const profile: Profile = {
    id: uuidv4(),
    name: name.trim(),
    enneagramType: String(enneagramType),
    description: tmpl?.description ?? "",
    axisWeights,
    thresholds: thresholds ?? tmpl?.thresholds ?? {},
    dealbreakers: dealbreakers ?? tmpl?.dealbreakers ?? [],
    ...(pastTripContext ? { pastTripContext } : {}),
  };

  // Write profile to inviter's account
  const { inviterUid, workspaceId } = record;
  await saveProfileToList(inviterUid, profile);

  // Add profile to workspace travelers if not already there
  const workspace = await getWorkspace(inviterUid, workspaceId);
  if (workspace && !workspace.travelers.includes(profile.id)) {
    if (workspace.travelers.length >= 4) {
      return NextResponse.json({ error: "This trip already has the maximum number of travelers (4)." }, { status: 409 });
    }
    workspace.travelers = [...workspace.travelers, profile.id];
    await saveWorkspace(inviterUid, workspace);
  }

  // Mark link as used
  await markAssessLinkCompleted(token);

  return NextResponse.json({ ok: true, profileName: profile.name });
}
