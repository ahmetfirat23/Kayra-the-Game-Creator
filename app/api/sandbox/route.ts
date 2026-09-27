import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  finishedGameFromUiMessages,
  type FinishedGame,
} from "../../../lib/finished-game";
import {
  createVercelSandboxClient,
  deleteGameSandbox,
  downloadGameArchive,
  ensureGameSandbox,
  extendSandboxTimeout,
  isSandboxGoneError,
} from "../../../lib/game-sandbox";
import {
  sandboxName,
  shouldRecreateStaleSandbox,
} from "../../../lib/sandbox-lifecycle";

export const runtime = "nodejs";
export const maxDuration = 300;

type SandboxAction =
  | "ensure"
  | "delete"
  | "download"
  | "heartbeat"
  | "leave"
  | "compile-error";

const LEAVE_GRACE_MS = 3_000;

type ThreadPage = {
  page?: Array<{ parts?: unknown }>;
  isDone?: boolean;
  continueCursor?: string;
};

/** Replay this chat's last successful commit. Null when no game has been committed. */
async function committedGame(
  convex: ConvexHttpClient,
  threadId: string | undefined,
): Promise<FinishedGame | null> {
  if (!threadId) return null;
  const messages: Array<{ parts?: unknown }> = [];
  let cursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
    const result = (await convex.query(api.chat.listThreadMessages, {
      threadId,
      paginationOpts: { numItems: 50, cursor },
      streamArgs: { kind: "list" },
    })) as ThreadPage;
    messages.push(...(result.page ?? []));
    if (result.isDone || !result.continueCursor) break;
    cursor = result.continueCursor;
  }
  return finishedGameFromUiMessages(messages);
}

type SandboxRequestBody = {
  chatId?: string;
  action?: SandboxAction;
};

async function readBody(req: Request): Promise<SandboxRequestBody> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return (await req.json()) as SandboxRequestBody;
    } catch {
      // Fall through to text parse (e.g. empty body).
    }
  }
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text) as SandboxRequestBody;
  } catch {
    return {};
  }
}

async function authenticatedConvexClient(): Promise<
  | { ok: true; convex: ConvexHttpClient }
  | { ok: false; response: NextResponse }
> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      ),
    };
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      ),
    };
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Convex URL is not configured." },
        { status: 500 },
      ),
    };
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);
  return { ok: true, convex };
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticatedConvexClient();
    if (!authResult.ok) return authResult.response;

    const { convex } = authResult;
    const body = await readBody(req);
    const chatId = body.chatId as Id<"chats"> | undefined;
    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 500 });
    }

    const action: SandboxAction = body.action ?? "ensure";
    const client = createVercelSandboxClient();

    if (action === "delete") {
      await deleteGameSandbox(chatId, { client });
      await convex.mutation(api.chat.clearSandbox, { chatId });
      return NextResponse.json({ ok: true });
    }

    if (action === "leave") {
      const started = Date.now();
      await new Promise((resolve) => setTimeout(resolve, LEAVE_GRACE_MS));
      const access = await convex.query(api.chat.getSandboxAccess, { chatId });
      if (access && access.updatedAt > started) {
        return NextResponse.json({ ok: true, cancelled: true });
      }
      await deleteGameSandbox(chatId, { client });
      await convex.mutation(api.chat.clearSandbox, { chatId });
      return NextResponse.json({ ok: true });
    }

    if (action === "download") {
      const access = await convex.query(api.chat.getSandboxAccess, { chatId });
      if (!access) {
        return NextResponse.json({
          success: false,
          error: "Project is not ready yet",
        });
      }
      const archive = await downloadGameArchive(chatId, { client });
      if (!archive.ok) {
        return NextResponse.json({
          success: false,
          error: "Project is not ready yet",
        });
      }
      return NextResponse.json({
        success: true,
        data: archive.data,
        filename: archive.filename,
      });
    }

    if (action === "heartbeat") {
      const access = await convex.query(api.chat.getSandboxAccess, { chatId });
      if (!access) {
        return NextResponse.json({ ok: true });
      }

      // A heartbeat means the page is still open, including a hidden tab whose
      // timer was throttled. It also cancels a leave started by reload.
      const sandbox = await client.get({ name: sandboxName(chatId) });
      if (!sandbox) {
        await convex.mutation(api.chat.clearSandbox, { chatId });
        return NextResponse.json({ ok: true, deleted: true });
      }
      await convex.mutation(api.chat.touchSandbox, { chatId });
      try {
        await extendSandboxTimeout(sandbox, 60_000);
      } catch (error) {
        if (!isSandboxGoneError(error)) throw error;
        try {
          await sandbox.delete();
        } catch {
          // Already stopped.
        }
        await convex.mutation(api.chat.clearSandbox, { chatId });
        return NextResponse.json({ ok: true, deleted: true });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "compile-error") {
      const access = await convex.query(api.chat.getSandboxAccess, { chatId });
      if (!access?.previewUrl || !access.token) {
        return NextResponse.json({ error: null });
      }
      try {
        const origin = access.previewUrl.replace(/\/$/, "");
        const response = await fetch(`${origin}/__kayra/compile-error`, {
          headers: { Authorization: `Bearer ${access.token}` },
          cache: "no-store",
        });
        if (!response.ok) return NextResponse.json({ error: null });
        const payload = (await response.json()) as { error?: unknown };
        const error =
          typeof payload.error === "string" && payload.error.trim()
            ? payload.error
            : null;
        return NextResponse.json({ error });
      } catch {
        return NextResponse.json({ error: null });
      }
    }

    // ensure (default)
    const access = await convex.query(api.chat.getSandboxAccess, { chatId });
    const chat = await convex.query(api.chat.getChat, { chatId });
    if (
      access &&
      shouldRecreateStaleSandbox({
        lastHeartbeatAt: access.updatedAt,
        now: Date.now(),
        aiTurnInProgress: Boolean(chat?.isAiTurn),
      })
    ) {
      await deleteGameSandbox(chatId, { client });
      await convex.mutation(api.chat.clearSandbox, { chatId });
    }

    const game = await committedGame(convex, chat?.threadId);
    const ensured = await ensureGameSandbox(chatId, {
      client,
      existingToken: access?.token,
      game,
    });

    await convex.mutation(api.chat.registerSandbox, {
      chatId,
      previewUrl: ensured.previewUrl,
      execUrl: ensured.execUrl,
      token: ensured.token,
    });

    return NextResponse.json({ previewUrl: ensured.previewUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sandbox request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
