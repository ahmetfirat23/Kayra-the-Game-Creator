import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  previewForClient,
  sandboxName,
  shouldDeleteSession,
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

describe("previewForClient", () => {
  it("returns only previewUrl", () => {
    assert.deepEqual(
      previewForClient({
        previewUrl: "https://preview.example/app",
      }),
      { previewUrl: "https://preview.example/app" },
    );
  });

  it("strips command token and execUrl from the payload", () => {
    const result = previewForClient({
      previewUrl: "https://preview.example/app",
      token: "secret-command-token",
      execUrl: "https://sandbox.example/exec",
    });

    assert.deepEqual(result, {
      previewUrl: "https://preview.example/app",
    });
    assert.equal("token" in result, false);
    assert.equal("execUrl" in result, false);
  });
});
