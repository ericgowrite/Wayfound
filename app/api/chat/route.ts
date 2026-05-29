import { NextResponse } from "next/server";
import { getProfile, getProfiles, getWorkspace } from "@/lib/storage";
import { chatAboutOption } from "@/lib/gemini";
import { friendlyError } from "@/lib/errorMessages";
import { ScoredOption, ChatMessage } from "@/types";

export async function POST(request: Request) {
  try {
    const { option, workspaceId, history, message, searchQuery } = await request.json() as {
      option: ScoredOption;
      workspaceId?: string;
      history: ChatMessage[];
      message: string;
      searchQuery?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Load traveler profiles from the workspace when available
    let profiles = [await getProfile()];
    if (workspaceId) {
      const workspace = await getWorkspace(workspaceId);
      if (workspace && workspace.travelers.length > 0) {
        const allProfiles = await getProfiles();
        const travelerProfiles = workspace.travelers
          .map((id) => allProfiles.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => !!p);
        if (travelerProfiles.length > 0) profiles = travelerProfiles;
      }
    }

    const reply = await chatAboutOption(option, profiles, history, message, searchQuery);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("Chat error:", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
