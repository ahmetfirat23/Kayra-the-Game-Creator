import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { handleHttpRequest, handleTool } from "./kayra-bridge.mjs";

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
