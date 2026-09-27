import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categorizeError } from "../convex/categorizeError.ts";
import {
  isFreestyleRepoId,
  missingSandboxSessionMessage,
  previewForClient,
} from "../convex/sandboxSession.ts";

describe("missing sandbox session", () => {
  it("produces a retryable connection error for categorizeError", () => {
    const message = missingSandboxSessionMessage();
    assert.match(message, /network/i);
    assert.doesNotMatch(message, /tool call/i);
    assert.doesNotMatch(message, /timeout/i);
    assert.doesNotMatch(message, /schema/i);
    assert.doesNotMatch(message, /stream/i);

    const { userMessage, shouldRethrow } = categorizeError(message);
    assert.ok(userMessage.length > 0);
    assert.equal(shouldRethrow, false);
  });
});

describe("previewForClient", () => {
  it("drops token and execUrl", () => {
    const result = previewForClient({
      previewUrl: "https://preview.example/app",
      token: "secret-command-token",
      execUrl: "https://sandbox.example/exec",
      updatedAt: 1_700_000_000_000,
    });

    assert.deepEqual(result, {
      previewUrl: "https://preview.example/app",
    });
    assert.equal("token" in result, false);
    assert.equal("execUrl" in result, false);
  });
});

describe("isFreestyleRepoId", () => {
  it("rejects sandbox and pending placeholders", () => {
    assert.equal(isFreestyleRepoId("sandbox"), false);
    assert.equal(isFreestyleRepoId("pending"), false);
  });

  it("accepts a Freestyle UUID", () => {
    assert.equal(
      isFreestyleRepoId("f15cbe22-0e7f-409a-8928-7fdc6b54e07d"),
      true,
    );
  });
});
