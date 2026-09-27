export type SandboxPageEvent =
  | "pagehide"
  | "beforeunload"
  | "sign-out"
  | "visibility-hidden";

export type SandboxPageAction = "leave";

/**
 * Map a browser lifecycle event to a sandbox API action.
 * Hiding the tab must not demolish the preview.
 * Reload and close both emit pagehide; the route waits briefly so a reload
 * can cancel the leave with a heartbeat.
 */
export function sandboxActionForPageEvent(
  event: SandboxPageEvent,
): SandboxPageAction | null {
  if (event === "visibility-hidden") return null;
  return "leave";
}
