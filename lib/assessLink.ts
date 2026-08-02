import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";

export interface AssessLinkRecord {
  token: string;
  inviterUid: string;
  workspaceId: string;
  status: "pending" | "completed";
  createdAt: string;
  expiresAt: string;
}

const COLLECTION = "assessLinks";
const TTL_DAYS = 7;

function col() {
  return adminDb.collection(COLLECTION);
}

export async function createAssessLink(
  inviterUid: string,
  workspaceId: string
): Promise<AssessLinkRecord> {
  const token = randomBytes(15).toString("base64url"); // 20 URL-safe chars
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);

  const record: AssessLinkRecord = {
    token,
    inviterUid,
    workspaceId,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await col().doc(token).set({
    ...record,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  return record;
}

export async function getAssessLink(token: string): Promise<AssessLinkRecord | null> {
  const doc = await col().doc(token).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    token,
    inviterUid: d.inviterUid,
    workspaceId: d.workspaceId,
    status: d.status,
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate().toISOString() : d.createdAt,
    expiresAt: d.expiresAt instanceof Timestamp ? d.expiresAt.toDate().toISOString() : d.expiresAt,
  };
}

export async function markAssessLinkCompleted(token: string): Promise<void> {
  await col().doc(token).update({ status: "completed" });
}
