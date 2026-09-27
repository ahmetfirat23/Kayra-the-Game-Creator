const SANDBOX_PREFIX = "kayra-";
const MAX_SLUG_LENGTH = 48;
const HEARTBEAT_STALE_MS = 60_000;

/** Build a Vercel-safe sandbox name: `kayra-<chatId>` with unsafe chars stripped. */
export function sandboxName(chatId: string): string {
  const slug = chatId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, MAX_SLUG_LENGTH);
  return `${SANDBOX_PREFIX}${slug}`;
}

export type SessionDeleteInput = {
  lastHeartbeatAt: number;
  now: number;
  leaveRequested: boolean;
};

/**
 * Whether the sandbox session should be deleted.
 * Leave (pagehide / sign-out) always deletes; otherwise delete when the
 * last heartbeat is at least 60 seconds old.
 */
export function shouldDeleteSession({
  lastHeartbeatAt,
  now,
  leaveRequested,
}: SessionDeleteInput): boolean {
  if (leaveRequested) return true;
  return now - lastHeartbeatAt >= HEARTBEAT_STALE_MS;
}

export type SandboxSessionPreview = {
  previewUrl: string;
  updatedAt?: number;
  token?: string;
  execUrl?: string;
  [key: string]: unknown;
};

export type ClientPreview = {
  previewUrl: string;
  /** True while a heartbeat has kept this machine inside the last 60 seconds. */
  live: boolean;
};

/** Client-safe preview payload. Never includes token or execUrl. */
export function previewForClient(
  session: SandboxSessionPreview,
  now = Date.now(),
): ClientPreview {
  const updatedAt = typeof session.updatedAt === "number" ? session.updatedAt : 0;
  return {
    previewUrl: session.previewUrl,
    live: now - updatedAt < HEARTBEAT_STALE_MS,
  };
}

/** Chat the user just left. Opening a chat does not start a machine. */
export function sandboxToStopOnSwitch(
  previousChatId: string | null,
  nextChatId: string | null,
): string | null {
  if (!previousChatId || previousChatId === nextChatId) return null;
  return previousChatId;
}

/**
 * "Reload the game" calls ensure, which may tear down and recreate the VM.
 * Never do that while Kayra is mid-turn — it kills the tool bridge and can
 * leave the composer stuck on a dead reply.
 */
export function shouldEnsureSandboxOnReload(isAiTurn: boolean): boolean {
  return !isAiTurn;
}

/** Recover a dead preview only when doing so cannot interrupt an agent tool call. */
export function shouldRecoverPreview(
  isAiTurn: boolean,
  previewHealthy: boolean,
): boolean {
  return !isAiTurn && !previewHealthy;
}

/**
 * The iframe shows the machine this chat is already running, including one
 * started by another screen. A stored URL with a stale heartbeat is stopped.
 * While Reload is starting a machine, keep the starting screen up.
 */
export function shouldShowLivePreview(input: {
  hasPreviewUrl: boolean;
  live: boolean;
  preparing: boolean;
}): boolean {
  if (input.preparing) return false;
  if (!input.live) return false;
  return input.hasPreviewUrl;
}

export type PreviewPane = "game" | "starting" | "loading" | "stopped" | "empty";

/** Which preview the pane shows. Shared by the PC and the phone. */
export function previewPane(input: {
  hasChat: boolean;
  hasMessages: boolean;
  hasPreviewUrl: boolean;
  live: boolean;
  preparing: boolean;
  previewKnown: boolean;
}): PreviewPane {
  if (
    shouldShowLivePreview({
      hasPreviewUrl: input.hasPreviewUrl,
      live: input.live,
      preparing: input.preparing,
    })
  ) {
    return "game";
  }
  if (input.preparing) return "starting";
  if (input.hasChat && !input.previewKnown) return "loading";
  if (input.hasChat && input.hasMessages) return "stopped";
  return "empty";
}

/** A new epoch must be a new iframe address, or the browser keeps the previous bundle. */
export function previewFrameSrc(previewUrl: string, epoch: number): string {
  const join = previewUrl.includes("?") ? "&" : "?";
  return `${previewUrl}${join}v=${epoch}`;
}

/** Bump when a reply finishes so the preview iframe loads the files Kayra just wrote. */
export function nextPreviewEpoch(
  wasAiTurn: boolean,
  isAiTurn: boolean,
  epoch: number,
): number {
  if (wasAiTurn && !isAiTurn) return epoch + 1;
  return epoch;
}

export type RecreateStaleInput = {
  lastHeartbeatAt: number;
  now: number;
  aiTurnInProgress: boolean;
};

/**
 * Whether ensure should delete a stale sandbox before recreating it.
 * A mid-turn reply still needs the live VM even if the heartbeat looks old.
 */
export function shouldRecreateStaleSandbox({
  lastHeartbeatAt,
  now,
  aiTurnInProgress,
}: RecreateStaleInput): boolean {
  if (aiTurnInProgress) return false;
  return shouldDeleteSession({
    lastHeartbeatAt,
    now,
    leaveRequested: false,
  });
}
