import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextPreviewEpoch,
  previewForClient,
  shouldShowLivePreview,
  sandboxName,
  sandboxToStopOnSwitch,
  shouldDeleteSession,
  shouldEnsureSandboxOnReload,
  shouldRecreateStaleSandbox,
} from "./sandbox-lifecycle.ts";

describe("sandboxName", () => {
  it("prefixes chatId with kayra-", () => {
    assert.equal(sandboxName("abc123"), "kayra-abc123");
  });

  it("strips characters outside [A-Za-z0-9_-]", () => {
    assert.equal(sandboxName("chat/id:with spaces!"), "kayra-chatidwithspaces");
  });

  it("keeps the name within a typical 63-character DNS label", () => {
    const longChatId = "a".repeat(80);
    const name = sandboxName(longChatId);
    assert.ok(name.startsWith("kayra-"));
    assert.ok(name.length <= 63);
    // Cap the slug (chatId portion) at 48 characters after the prefix.
    assert.equal(name, `kayra-${"a".repeat(48)}`);
    assert.equal(name.length, "kayra-".length + 48);
  });
});

describe("shouldDeleteSession", () => {
  const now = 1_000_000;

  it("deletes when leave was requested (pagehide / sign-out)", () => {
    assert.equal(
      shouldDeleteSession({
        lastHeartbeatAt: now - 5_000,
        now,
        leaveRequested: true,
      }),
      true,
    );
  });

  it("deletes when there has been no heartbeat for 60 seconds", () => {
    assert.equal(
      shouldDeleteSession({
        lastHeartbeatAt: now - 60_000,
        now,
        leaveRequested: false,
      }),
      true,
    );
    assert.equal(
      shouldDeleteSession({
        lastHeartbeatAt: now - 60_001,
        now,
        leaveRequested: false,
      }),
      true,
    );
  });

  it("keeps the session when a heartbeat is newer than 60 seconds", () => {
    assert.equal(
      shouldDeleteSession({
        lastHeartbeatAt: now - 59_999,
        now,
        leaveRequested: false,
      }),
      false,
    );
    assert.equal(
      shouldDeleteSession({
        lastHeartbeatAt: now,
        now,
        leaveRequested: false,
      }),
      false,
    );
  });
});

describe("sandboxToStopOnSwitch", () => {
  it("stops the chat that was left", () => {
    assert.equal(sandboxToStopOnSwitch("chat-a", "chat-b"), "chat-a");
  });

  it("does not stop a machine when a chat is opened from nothing", () => {
    assert.equal(sandboxToStopOnSwitch(null, "chat-a"), null);
  });

  it("does not stop the chat that is still selected", () => {
    assert.equal(sandboxToStopOnSwitch("chat-a", "chat-a"), null);
  });
});

describe("shouldEnsureSandboxOnReload", () => {
  it("refuses ensure while Kayra is mid-turn so Reload cannot kill the tool bridge", () => {
    assert.equal(shouldEnsureSandboxOnReload(true), false);
  });

  it("allows ensure when no AI turn is in progress", () => {
    assert.equal(shouldEnsureSandboxOnReload(false), true);
  });
});

describe("shouldRecreateStaleSandbox", () => {
  const now = 1_000_000;

  it("does not delete a stale VM while an AI turn is using it", () => {
    assert.equal(
      shouldRecreateStaleSandbox({
        lastHeartbeatAt: now - 60_000,
        now,
        aiTurnInProgress: true,
      }),
      false,
    );
  });

  it("still recreates a stale VM when no AI turn is in progress", () => {
    assert.equal(
      shouldRecreateStaleSandbox({
        lastHeartbeatAt: now - 60_000,
        now,
        aiTurnInProgress: false,
      }),
      true,
    );
  });

  it("keeps a fresh heartbeat even when idle", () => {
    assert.equal(
      shouldRecreateStaleSandbox({
        lastHeartbeatAt: now - 10_000,
        now,
        aiTurnInProgress: false,
      }),
      false,
    );
  });
});

describe("previewForClient", () => {
  it("returns previewUrl and whether the heartbeat is still fresh", () => {
    assert.deepEqual(
      previewForClient(
        {
          previewUrl: "https://preview.example/app",
          updatedAt: 1_000,
        },
        1_000,
      ),
      { previewUrl: "https://preview.example/app", live: true },
    );
  });

  it("strips command token and execUrl from the payload", () => {
    const result = previewForClient(
      {
        previewUrl: "https://preview.example/app",
        token: "secret-command-token",
        execUrl: "https://sandbox.example/exec",
        updatedAt: 1_000,
      },
      61_000,
    );

    assert.deepEqual(result, {
      previewUrl: "https://preview.example/app",
      live: false,
    });
    assert.equal("token" in result, false);
    assert.equal("execUrl" in result, false);
  });
});

describe("shouldShowLivePreview", () => {
  it("shows the machine another screen already started", () => {
    assert.equal(
      shouldShowLivePreview({
        hasPreviewUrl: true,
        live: true,
        preparing: false,
      }),
      true,
    );
  });

  it("keeps a stale preview URL behind Reload", () => {
    assert.equal(
      shouldShowLivePreview({
        hasPreviewUrl: true,
        live: false,
        preparing: false,
      }),
      false,
    );
  });

  it("keeps the starting screen up while the machine is still starting", () => {
    assert.equal(
      shouldShowLivePreview({
        hasPreviewUrl: true,
        live: true,
        preparing: true,
      }),
      false,
    );
  });
});

describe("nextPreviewEpoch", () => {
  it("reloads the preview when a reply finishes", () => {
    assert.equal(nextPreviewEpoch(true, false, 0), 1);
    assert.equal(nextPreviewEpoch(true, false, 3), 4);
  });

  it("leaves the preview alone while Kayra is still writing", () => {
    assert.equal(nextPreviewEpoch(false, true, 1), 1);
    assert.equal(nextPreviewEpoch(true, true, 1), 1);
    assert.equal(nextPreviewEpoch(false, false, 2), 2);
  });
});
