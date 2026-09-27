export const VIEWER_LEASE_MS = 60_000;
export const CLEANUP_DELAY_MS = 65_000;

export type SandboxViewer = { id: string; lastSeen: number };

/** Older app tabs heartbeat without a viewer ID; keep one shared lease per account. */
export function requestViewerId(viewerId: unknown, userId: string): string | null {
  const id = typeof viewerId === "string" && viewerId ? viewerId : `legacy:${userId}`;
  return id.length <= 100 ? id : null;
}

export function activeViewers(viewers: SandboxViewer[], now: number): SandboxViewer[] {
  return viewers.filter((viewer) => now - viewer.lastSeen < VIEWER_LEASE_MS);
}

export function touchViewer(viewers: SandboxViewer[], id: string, now: number): SandboxViewer[] {
  return [...activeViewers(viewers, now).filter((viewer) => viewer.id !== id), { id, lastSeen: now }];
}

export function removeViewer(viewers: SandboxViewer[], id: string, now: number): SandboxViewer[] {
  return activeViewers(viewers, now).filter((viewer) => viewer.id !== id);
}
