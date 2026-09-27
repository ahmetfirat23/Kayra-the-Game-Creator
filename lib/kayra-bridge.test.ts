import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BRIDGE_HEALTH,
  commitRestartsPreview,
  expoRestartScript,
  handleHttpRequest,
  handleTool,
  layoutTouchPath,
  expoRestartOrder,
  previewResponseHeaders,
  previewWaitingPage,
  refusedShell,
} from "./kayra-bridge.mjs";

function mockRes() {
  const state: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  } = { statusCode: 200, headers: {}, body: "" };

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
    },
    end(chunk?: string | Buffer) {
      state.statusCode = res.statusCode;
      if (chunk !== undefined) state.body = String(chunk);
    },
    writeHead(code: number, headers?: Record<string, string>) {
      res.statusCode = code;
      state.statusCode = code;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          state.headers[k.toLowerCase()] = v;
        }
      }
    },
  };

  return { res, state };
}

describe("kayra-bridge auth", () => {
  it("refuses a tool request without a bearer token", async () => {
    const { res, state } = mockRes();
    const body = Buffer.from(
      JSON.stringify({ name: "list_directory", arguments: {} }),
    );
    const req = {
      method: "POST",
      url: "/__kayra/tool",
      headers: { "content-type": "application/json" },
      on(event: string, cb: (chunk?: Buffer) => void) {
        if (event === "data") {
          queueMicrotask(() => cb(body));
        } else if (event === "end") {
          queueMicrotask(() => {
            queueMicrotask(() => cb());
          });
        }
        return req;
      },
    };

    process.env.KAYRA_TOKEN = "secret-token";
    await handleHttpRequest(req as never, res as never);

    assert.equal(state.statusCode, 401);
  });
});

describe("kayra-bridge edit_file", () => {
  it("returns text when oldText is not in the file and does not throw", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "kayra-bridge-"));
    const filePath = path.join(dir, "app.tsx");
    await writeFile(filePath, "const x = 1;\n", "utf8");

    const result = await handleTool("edit_file", {
      path: filePath,
      edits: [{ oldText: "does-not-exist", newText: "const x = 2;" }],
    });

    assert.ok(Array.isArray(result.content));
    assert.equal(result.content[0]?.type, "text");
    assert.match(result.content[0]?.text ?? "", /not found|missing|oldText/i);

    const after = await readFile(filePath, "utf8");
    assert.equal(after, "const x = 1;\n");
  });
});

describe("kayra-bridge refused commands", () => {
  it("refuses reset-project, lint, and a second dev server", async () => {
    for (const command of [
      "npm run reset-project",
      "npm run lint",
      "npx expo lint",
      "npm run dev",
      "npx expo start --web --port 3000",
      "npm install",
      "cd /template && npm ci",
      "yarn install",
      "pnpm install",
    ]) {
      const result = await handleTool("exec", { command });
      assert.equal(refusedShell(command) !== null, true);
      assert.match(result.content[0]?.text ?? "", /do not/i);
    }
  });

  it("allows installing one named package", () => {
    assert.equal(refusedShell("npm install howler"), null);
  });

  it("does not reinstall when npm_install has no safe package names", async () => {
    const empty = await handleTool("npm_install", {});
    const injected = await handleTool("npm_install", {
      packages: ["three; rm -rf /"],
    });
    assert.match(empty.content[0]?.text ?? "", /already installed/i);
    assert.match(injected.content[0]?.text ?? "", /already installed/i);
  });

  it("shows a page that reloads while Expo is starting", () => {
    const page = previewWaitingPage();
    assert.match(page, /refresh/);
    assert.match(page, /Starting your game/);
    assert.match(page, /#F0E6FA/);
    assert.match(page, /#E8F4FC/);
    assert.match(page, /🌳/);
    assert.match(page, /position:\s*fixed/);
    assert.match(page, /inset:\s*0/);
  });

  it("touches the app layout after a write inside the tabs route", () => {
    assert.equal(
      layoutTouchPath("/template/app/(tabs)/index.tsx"),
      "/template/app/_layout.tsx",
    );
    assert.equal(layoutTouchPath("/template/components/Player.tsx"), null);
  });

  it("restarts Expo after a commit only inside a sandbox", () => {
    assert.equal(commitRestartsPreview({ KAYRA_RESTART_EXPO: "1" }), true);
    assert.equal(commitRestartsPreview({}), false);
    const script = expoRestartScript();
    assert.match(script, /max-old-space-size=1536/);
    assert.match(script, /fuser -k 19006\/tcp/);
    assert.match(script, /pkill -f '\[e\]xpo'/);
    assert.match(script, /--clear/);
    assert.match(script, /rm -rf \/template\/\.expo/);
    assert.match(script, /node_modules\/\.cache/);
    assert.equal(BRIDGE_HEALTH, "ok 7");
    assert.deepEqual(expoRestartOrder({ KAYRA_RESTART_EXPO: "1" }), ["stop", "start"]);
    assert.deepEqual(expoRestartOrder({}), []);
  });

  it("does not let the browser keep the previous bundle", () => {
    const headers = previewResponseHeaders({
      "Content-Type": "text/html",
      ETag: "old-bundle",
      "Cache-Control": "public, max-age=31536000",
      "X-Frame-Options": "DENY",
    });
    assert.equal(headers["cache-control"], "no-store");
    assert.equal(headers["Content-Type"], "text/html");
    assert.equal("ETag" in headers, false);
    assert.equal("X-Frame-Options" in headers, false);
  });
});
