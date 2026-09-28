import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { describe, it } from "node:test";
import {
  BRIDGE_HEALTH,
  commitRestartsPreview,
  expoRestartScript,
  handleHttpRequest,
  handleTool,
  layoutTouchPath,
  expoRestartOrder,
  expoProxyHeaders,
  fileExcerpt,
  searchCode,
  compileErrorText,
  decodePreviewErrorBody,
  currentCompileError,
  fixingPreviewPage,
  noteCompileError,
  injectPreviewPlayStyles,
  previewDocumentHeaders,
  previewResponseHeaders,
  previewErrorText,
  isExpoCorsError,
  previewWaitingPage,
  RESTART_SCRIPT_PATH,
  refusedShell,
  waitForExpoDownShell,
  waitForExpoUpShell,
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

describe("bounded code inspection", () => {
  it("returns numbered ranges with a continuation instead of a whole file", () => {
    const content = Array.from({ length: 300 }, (_, i) => `line ${i + 1}`).join("\n");
    const first = fileExcerpt(content);
    assert.match(first, /^1: line 1/);
    assert.match(first, /continue at 161/);
    assert.doesNotMatch(first, /300: line 300/);
    const later = fileExcerpt(content, 200, 210);
    assert.match(later, /^200: line 200/);
    assert.match(later, /210: line 210/);
  });

  it("searches source lines without returning full file content", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "kayra-search-"));
    await writeFile(path.join(dir, "Game.tsx"), "first\nconst playerSpeed = 3;\nlast", "utf8");
    const result = await searchCode(dir, "playerSpeed");
    assert.match(result, /Game\.tsx:2: const playerSpeed = 3/);
    assert.doesNotMatch(result, /first|last/);
  });
});

describe("kayra-bridge refused commands", () => {
  it("checks Expo's listening port without waiting for a full web bundle", () => {
    assert.match(waitForExpoUpShell(), /dev\/tcp\/127\.0\.0\.1\/19006/);
    assert.match(waitForExpoDownShell(), /dev\/tcp\/127\.0\.0\.1\/19006/);
    assert.doesNotMatch(waitForExpoUpShell(), /curl/);
  });

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

  it("polls quietly while Expo is starting instead of refreshing the page", () => {
    const page = previewWaitingPage();
    assert.doesNotMatch(page, /http-equiv="refresh"/);
    assert.match(page, /fetch\(location\.href/);
    assert.match(page, /if \(checking\) return/);
    assert.match(page, /AbortSignal\.timeout\(4000\)/);
    assert.match(page, /setTimeout\(\(\) => location\.reload\(\), 45000\)/);
    assert.match(page, /data-kayra-preview-waiting/);
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
    assert.match(script, /pkill -f '\[c\]li\.\*start\.\*19006'/);
    assert.match(script, /--clear/);
    assert.match(script, /rm -rf \/template\/\.expo/);
    assert.match(script, /node_modules\/\.cache/);
    assert.doesNotMatch(RESTART_SCRIPT_PATH, /expo/i);
    assert.match(script, /kayra-restart-preview\.log/);
    assert.match(script, /flock -n \/tmp\/kayra-expo\.lock/);
    assert.equal(BRIDGE_HEALTH, "ok 19");
    assert.deepEqual(expoRestartOrder({ KAYRA_RESTART_EXPO: "1" }), ["stop", "start"]);
    assert.deepEqual(expoRestartOrder({}), []);
  });

  it("stops text selection in the game document", () => {
    const html = injectPreviewPlayStyles("<!doctype html><html><head><title>Game</title></head><body>Score</body></html>");
    assert.match(html, /<head><style data-kayra-play="1">/);
    assert.match(html, /user-select:\s*none !important/);
    assert.match(html, /input, textarea/);
    assert.match(html, /selectstart/);
    assert.equal(injectPreviewPlayStyles(html), html);
    const headers = previewDocumentHeaders({
      "Content-Type": "text/html",
      "Content-Length": "12",
      "Content-Encoding": "gzip",
    });
    assert.equal(headers["Content-Type"], "text/html");
    assert.equal("Content-Length" in headers, false);
    assert.equal("Content-Encoding" in headers, false);
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

  it("keeps a compile error for the agent and shows a fixing screen", () => {
    const error = compileErrorText(500, '{"message":"SyntaxError: Unexpected token"}');
    assert.match(error || "", /SyntaxError/);
    assert.equal(compileErrorText(200, "SyntaxError: Unexpected token"), null);
    assert.equal(compileErrorText(404, "missing file"), null);
    assert.equal(previewErrorText(500, "x not found", true), "x not found");
    assert.equal(previewErrorText(404, "missing file", false), null);
    assert.match(previewErrorText(500, "<h1>Server Error</h1><pre>render failed</pre>", false, true) || "", /Preview document failed with HTTP 500/);
    assert.equal(previewErrorText(404, "Not found", false, true), null);
    noteCompileError(error);
    assert.match(currentCompileError(), /SyntaxError/);
    const page = fixingPreviewPage();
    assert.match(page, /Kayra is fixing your game/);
    assert.doesNotMatch(page, /SyntaxError/);
  });

  it("decodes compressed Expo errors without sending binary text to the agent", () => {
    const html = "<h1>Server Error</h1><pre>render failed</pre>";
    assert.equal(decodePreviewErrorBody(gzipSync(html), "gzip"), html);
    assert.equal(decodePreviewErrorBody(brotliCompressSync(html), "br"), html);
    assert.equal(decodePreviewErrorBody(gzipSync(html), undefined), html);
    assert.equal(decodePreviewErrorBody(Buffer.from([0xff, 0x00, 0xfe]), "identity"), "");
    assert.equal(decodePreviewErrorBody(Buffer.from("bad gzip"), "gzip"), "");
    assert.equal(previewErrorText(500, "", false, true), "Preview document failed with HTTP 500.");
  });

  it("keeps the browser origin out of Expo and recognizes its CORS failure", () => {
    const headers = expoProxyHeaders({
      host: "sb-example.vercel.run",
      origin: "https://sb-example.vercel.run",
      "x-forwarded-host": "sb-example.vercel.run",
      "x-forwarded-proto": "https",
      accept: "text/html",
    });
    assert.equal(headers.host, "127.0.0.1:19006");
    assert.equal(headers.origin, undefined);
    assert.equal(headers["x-forwarded-host"], undefined);
    assert.equal(headers.accept, "text/html");
    assert.equal(isExpoCorsError("Unauthorized request from https://sb-example.vercel.run. This may happen because of a conflicting browser extension to intercept HTTP requests."), true);
    assert.equal(isExpoCorsError("Unable to resolve module ./music.wav"), false);
  });
});
