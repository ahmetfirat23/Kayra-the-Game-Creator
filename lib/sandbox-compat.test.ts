import assert from "node:assert/strict";
import { it } from "node:test";
import { missingViewerRelease, rejectsNewSandboxField } from "./sandbox-compat.ts";

it("retries only old validator errors for the new sandbox fields", () => {
  assert.equal(rejectsNewSandboxField(new Error("ArgumentValidationError: Object contains extra field `appOrigin`"), ["appOrigin"]), true);
  assert.equal(rejectsNewSandboxField(new Error("ArgumentValidationError: Object contains extra field `viewerId`"), ["viewerId", "appOrigin"]), true);
  assert.equal(rejectsNewSandboxField(new Error("ArgumentValidationError: Object contains extra field `token`"), ["appOrigin"]), false);
  assert.equal(rejectsNewSandboxField(new Error("Not authenticated"), ["appOrigin"]), false);
});

it("ignores only a missing viewer release on an older deployment", () => {
  assert.equal(missingViewerRelease(new Error("Could not find public function for 'chat:releaseSandboxViewer'.")), true);
  assert.equal(missingViewerRelease(new Error("Could not find public function for 'chat:deleteChat'.")), false);
});
