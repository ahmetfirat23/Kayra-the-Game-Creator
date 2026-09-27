import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sandboxActionForPageEvent } from "./sandbox-page.ts";

describe("sandboxActionForPageEvent", () => {
  it("deletes on pagehide", () => {
    assert.equal(sandboxActionForPageEvent("pagehide"), "leave");
  });

  it("deletes on beforeunload", () => {
    assert.equal(sandboxActionForPageEvent("beforeunload"), "leave");
  });

  it("deletes on sign-out", () => {
    assert.equal(sandboxActionForPageEvent("sign-out"), "leave");
  });

  it("does not delete when the tab only becomes hidden", () => {
    assert.equal(sandboxActionForPageEvent("visibility-hidden"), null);
  });
});
