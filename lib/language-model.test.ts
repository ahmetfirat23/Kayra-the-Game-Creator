import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG } from "../convex/config.ts";

describe("CONFIG.LANGUAGE_MODEL", () => {
  it('is gpt-5.6-luna', () => {
    assert.equal(CONFIG.LANGUAGE_MODEL, "gpt-5.6-luna");
  });

  it("is not gpt-5-mini, gpt-5.4-mini, or gpt-5.6-terra", () => {
    assert.notEqual(CONFIG.LANGUAGE_MODEL, "gpt-5-mini");
    assert.notEqual(CONFIG.LANGUAGE_MODEL, "gpt-5.4-mini");
    assert.notEqual(CONFIG.LANGUAGE_MODEL, "gpt-5.6-terra");
  });
});
