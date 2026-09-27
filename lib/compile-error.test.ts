import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compileFixPrompt,
  isHiddenCompileFix,
} from "./compile-error.ts";

describe("compile fix prompt", () => {
  it("hides the compiler text from the chat and still includes it for the agent", () => {
    const prompt = compileFixPrompt("SyntaxError: Unexpected token");
    assert.equal(isHiddenCompileFix(prompt), true);
    assert.match(prompt, /SyntaxError: Unexpected token/);
    assert.match(prompt, /Do not repeat the compiler output/);
    assert.equal(isHiddenCompileFix("hello"), false);
  });
});
