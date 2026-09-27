import assert from "node:assert/strict";
import { it } from "node:test";
import { activeViewers, removeViewer, requestViewerId, touchViewer } from "./sandbox-viewers.ts";

it("keeps independent tabs and expires a crashed tab", () => {
  const one = touchViewer([], "tab-a", 0);
  const two = touchViewer(one, "tab-b", 20_000);
  assert.deepEqual(activeViewers(two, 50_000).map((viewer) => viewer.id), ["tab-a", "tab-b"]);
  assert.deepEqual(activeViewers(two, 60_000).map((viewer) => viewer.id), ["tab-b"]);
  assert.deepEqual(removeViewer(two, "tab-a", 30_000).map((viewer) => viewer.id), ["tab-b"]);
  assert.deepEqual(touchViewer(two, "tab-a", 30_000).map((viewer) => viewer.id), ["tab-b", "tab-a"]);
});

it("gives older tabs a stable account lease without accepting oversized IDs", () => {
  assert.equal(requestViewerId(undefined, "user-1"), "legacy:user-1");
  assert.equal(requestViewerId(undefined, "user-1"), requestViewerId(undefined, "user-1"));
  assert.equal(requestViewerId("tab-2", "user-1"), "tab-2");
  assert.equal(requestViewerId("x".repeat(101), "user-1"), null);
});
