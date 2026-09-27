import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { createVercelSandboxClient, deleteGameSandbox } from "../../../../lib/game-sandbox";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { chatId?: string; token?: string } | null;
  if (!body?.chatId || !body.token || !process.env.NEXT_PUBLIC_CONVEX_URL) {
    return NextResponse.json({ error: "Invalid cleanup request" }, { status: 400 });
  }

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    const chatId = body.chatId as Id<"chats">;
    const args = { chatId, token: body.token };
    if (!await convex.query(api.chat.cleanupAccess, args)) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    await deleteGameSandbox(chatId, { client: createVercelSandboxClient() });
    await convex.mutation(api.chat.clearSandboxWithTokenIfIdle, args);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sandbox cleanup failed", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
