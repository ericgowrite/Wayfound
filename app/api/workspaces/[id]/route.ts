import { NextResponse } from "next/server";
import { getWorkspace, saveWorkspace, deleteWorkspace } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await getWorkspace(id);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(workspace);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await request.json();
    if (workspace.id !== id) return NextResponse.json({ error: "ID mismatch" }, { status: 400 });
    await saveWorkspace(workspace);
    return NextResponse.json(workspace);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteWorkspace(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
