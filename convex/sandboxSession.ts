/**
 * Pure helpers for sandbox session identity, client-safe preview payloads,
 * and the missing-session error used by processMessage.
 */

export type SandboxSessionRow = {
    previewUrl: string;
    execUrl: string;
    token: string;
    updatedAt: number;
};

export type ClientPreview = {
    previewUrl: string;
};

/** Client-safe preview payload: previewUrl only — never token or execUrl. */
export function previewForClient(
    session: Pick<SandboxSessionRow, "previewUrl"> & {
        token?: string;
        execUrl?: string;
        [key: string]: unknown;
    },
): ClientPreview {
    return { previewUrl: session.previewUrl };
}

/**
 * Error message when processMessage has no sandbox session.
 * Must include "network" and must not match tool/timeout/schema/stream
 * branches in categorizeError so the send is refused as a retryable connection error.
 */
export function missingSandboxSessionMessage(): string {
    return "Sandbox network unavailable: no active sandbox session for this chat.";
}

/** True when repoId looks like a Freestyle Git repository UUID. */
export function isFreestyleRepoId(repoId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(repoId);
}
