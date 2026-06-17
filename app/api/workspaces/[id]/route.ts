import { NextResponse } from "next/server";
import { getWorkspace, saveWorkspace, deleteWorkspace } from "@/lib/storage";
import { getUserId, AuthError } from "@/lib/serverAuth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(request);
    const { id } = await params;
    const workspace = await getWorkspace(userId, id);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(workspace);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(request);
    const { id } = await params;
    const workspace = await request.json();
    if (workspace.id !== id) return NextResponse.json({ error: "ID mismatch" }, { status: 400 });
    await saveWorkspace(userId, workspace);
    return NextResponse.json(workspace);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(request);
    const { id } = await params;
    await deleteWorkspace(userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
