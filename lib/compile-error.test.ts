import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compileFixPrompt,
  isHiddenCompileFix,
  isPreviewInfrastructureError,
} from "./compile-error.ts";

describe("compile fix prompt", () => {
  it("hides the compiler text from the chat and still includes it for the agent", () => {
    const prompt = compileFixPrompt("SyntaxError: Unexpected token");
    assert.equal(isHiddenCompileFix(prompt), true);
    assert.match(prompt, /SyntaxError: Unexpected token/);
    assert.match(prompt, /Do not repeat the compiler output/);
    assert.equal(isHiddenCompileFix("hello"), false);
  });

  it("does not send Expo proxy failures to the game agent", () => {
    assert.equal(isPreviewInfrastructureError("Preview document failed with HTTP 500. Error: Unauthorized request from https://sb-123.vercel.run. This may happen because of a conflicting browser extension to intercept HTTP requests."), true);
    assert.equal(isPreviewInfrastructureError("Unable to resolve module ./music.wav"), false);
  });
});
