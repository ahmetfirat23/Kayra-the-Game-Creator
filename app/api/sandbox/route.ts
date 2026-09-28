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
  shouldRecoverPreview,
} from "../../../lib/sandbox-lifecycle";
import { missingViewerRelease, rejectsNewSandboxField } from "../../../lib/sandbox-compat";
import { requestViewerId } from "../../../lib/sandbox-viewers";
import { BRIDGE_HEALTH } from "../../../lib/kayra-bridge.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;

type SandboxAction =
  | "ensure"
  | "delete"
  | "download"
  | "heartbeat"
  | "release"
  | "compile-error";

type ThreadPage = {
  page?: Array<{ parts?: unknown }>;
  isDone?: boolean;
  continueCursor?: string;
};

/** Replay this chat's last successful commit. Null when no game has been committed. */
async function committedGame(
  convex: ConvexHttpClient,
  chatId: Id<"chats">,
  threadId: string | undefined,
): Promise<FinishedGame | null> {
  if (!threadId) return null;
  let snapshot: { files: FinishedGame["files"] } | null = null;
  try {
    snapshot = await convex.query(api.gameSnapshots.get, { chatId });
  } catch (error) {
    // Vercel may deploy before the matching Convex function. Keep existing
    // games loadable until the backend deployment catches up.
    if (!/gameSnapshots:get/i.test(String(error)) || !/not found|could not find|not registered/i.test(String(error))) throw error;
  }
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
  const replayed = finishedGameFromUiMessages(messages);
  if (snapshot) return { files: snapshot.files, diskEdits: [], packages: replayed?.packages ?? [] };
  return replayed;
}

type SandboxRequestBody = {
  chatId?: string;
  action?: SandboxAction;
  viewerId?: string;
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
  | { ok: true; convex: ConvexHttpClient; userId: string }
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
  return { ok: true, convex, userId };
}

async function previewProcessHealthy(access: {
  previewUrl: string;
  token: string;
}): Promise<boolean> {
  try {
    const origin = access.previewUrl.replace(/\/$/, "");
    const health = await fetch(`${origin}/__kayra/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!health.ok || (await health.text()).trim() !== BRIDGE_HEALTH) return false;
    const response = await fetch(`${origin}/__kayra/preview-health`, {
      headers: { Authorization: `Bearer ${access.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok && (await response.text()).trim() === "ready";
  } catch {
    return false;
  }
}

async function registerSandboxCompat(
  convex: ConvexHttpClient,
  args: { chatId: Id<"chats">; previewUrl: string; execUrl: string; token: string; appOrigin: string },
) {
  try {
    await convex.mutation(api.chat.registerSandbox, args);
  } catch (error) {
    if (!rejectsNewSandboxField(error, ["appOrigin"])) throw error;
    const legacyArgs = {
      chatId: args.chatId,
      previewUrl: args.previewUrl,
      execUrl: args.execUrl,
      token: args.token,
    };
    await convex.mutation(api.chat.registerSandbox, legacyArgs as typeof args);
  }
}

async function touchSandboxCompat(
  convex: ConvexHttpClient,
  args: { chatId: Id<"chats">; viewerId: string; appOrigin: string },
) {
  try {
    await convex.mutation(api.chat.touchSandbox, args);
  } catch (error) {
    if (!rejectsNewSandboxField(error, ["viewerId", "appOrigin"])) throw error;
    await convex.mutation(api.chat.touchSandbox, { chatId: args.chatId } as typeof args);
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticatedConvexClient();
    if (!authResult.ok) return authResult.response;

    const { convex, userId } = authResult;
    const body = await readBody(req);
    const chatId = body.chatId as Id<"chats"> | undefined;
    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 500 });
    }

    const action: SandboxAction = body.action ?? "ensure";
    const client = createVercelSandboxClient();

    const viewerId = requestViewerId(body.viewerId, userId);
    if (action === "heartbeat" && !viewerId) {
      return NextResponse.json({ error: "Invalid viewerId" }, { status: 400 });
    }

    if (action === "release") {
      if (!body.viewerId) return NextResponse.json({ ok: true });
      if (!viewerId) return NextResponse.json({ error: "Invalid viewerId" }, { status: 400 });
      try {
        await convex.mutation(api.chat.releaseSandboxViewer, { chatId, viewerId });
      } catch (error) {
        if (!missingViewerRelease(error)) throw error;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
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

      // Touch before slow VM/network checks so other tabs see a live preview.
      await touchSandboxCompat(convex, { chatId, viewerId: viewerId!, appOrigin: new URL(req.url).origin });
      const sandbox = await client.get({ name: sandboxName(chatId) });
      if (!sandbox) {
        await convex.mutation(api.chat.clearSandbox, { chatId });
        return NextResponse.json({ ok: true, deleted: true });
      }

      const chat = await convex.query(api.chat.getChat, { chatId });
      const previewHealthy =
        Boolean(chat?.isAiTurn) || (await previewProcessHealthy(access));
      if (shouldRecoverPreview(Boolean(chat?.isAiTurn), previewHealthy)) {
        const game = await committedGame(convex, chatId, chat?.threadId);
        const ensured = await ensureGameSandbox(chatId, {
          client,
          existingToken: access.token,
          game,
        });
        await registerSandboxCompat(convex, {
          chatId,
          previewUrl: ensured.previewUrl,
          execUrl: ensured.execUrl,
          token: ensured.token,
          appOrigin: new URL(req.url).origin,
        });
        return NextResponse.json({ ok: true, recovered: true });
      }

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
    const game = await committedGame(convex, chatId, chat?.threadId);
    const ensured = await ensureGameSandbox(chatId, {
      client,
      existingToken: access?.token,
      game,
    });

    await registerSandboxCompat(convex, {
      chatId,
      previewUrl: ensured.previewUrl,
      execUrl: ensured.execUrl,
      token: ensured.token,
      appOrigin: new URL(req.url).origin,
    });

    return NextResponse.json({ previewUrl: ensured.previewUrl });
  } catch (error) {
    console.error("Sandbox request failed:", error);
    return NextResponse.json(
      { error: "Game environment request failed. Please try again." },
      { status: 500 },
    );
  }
}
