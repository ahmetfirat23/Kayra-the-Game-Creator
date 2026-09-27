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
  token?: string;
  execUrl?: string;
  [key: string]: unknown;
};

export type ClientPreview = {
  previewUrl: string;
};

/** Client-safe preview payload: previewUrl only — never token or execUrl. */
export function previewForClient(session: SandboxSessionPreview): ClientPreview {
  return { previewUrl: session.previewUrl };
}

/** Chat the user just left. Opening a chat does not start a machine. */
export function sandboxToStopOnSwitch(
  previousChatId: string | null,
  nextChatId: string | null,
): string | null {
  if (!previousChatId || previousChatId === nextChatId) return null;
  return previousChatId;
}
