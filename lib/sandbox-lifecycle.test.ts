import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextPreviewEpoch,
  previewForClient,
  shouldShowLivePreview,
  sandboxName,
  shouldEnsureSandboxOnReload,
  shouldRecoverPreview,
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

describe("shouldEnsureSandboxOnReload", () => {
  it("refuses ensure while Kayra is mid-turn so Reload cannot kill the tool bridge", () => {
    assert.equal(shouldEnsureSandboxOnReload(true), false);
  });

  it("allows ensure when no AI turn is in progress", () => {
    assert.equal(shouldEnsureSandboxOnReload(false), true);
  });
});

describe("shouldRecoverPreview", () => {
  it("recovers an idle sandbox whose Expo process is down", () => {
    assert.equal(shouldRecoverPreview(false, false), true);
  });

  it("does not interrupt an AI turn or restart a healthy preview", () => {
    assert.equal(shouldRecoverPreview(true, false), false);
    assert.equal(shouldRecoverPreview(false, true), false);
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

  it("shows a live machine while a slow ensure request is still finishing", () => {
    assert.equal(
      shouldShowLivePreview({
        hasPreviewUrl: true,
        live: true,
        preparing: true,
      }),
      true,
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
