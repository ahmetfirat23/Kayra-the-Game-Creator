import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.KAYRA_TOKEN || "";
const EXPO_PORT = 19006;
const PORT = Number(process.env.KAYRA_BRIDGE_PORT || 3000);
const ROOT = process.env.KAYRA_ROOT || "/template";

export function textResult(text) {
  return { content: [{ type: "text", text: String(text ?? "") }] };
}

function quote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function run(command, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", command], { cwd: ROOT });
    let out = "";
    const append = (chunk) => {
      if (out.length < 80_000) out += chunk.toString();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, out: String(error) });
    });
  });
}

export async function handleTool(name, args = {}) {
  const input = args || {};
  try {
    if (name === "list_directory") {
      const dir = input.path || ROOT;
      const result = await run("ls -la " + quote(dir));
      return textResult(result.out || "(empty)");
    }

    if (name === "read_file") {
      const content = await fs.readFile(input.path, "utf8");
      return textResult(content);
    }

    if (name === "write_file") {
      await fs.mkdir(path.dirname(input.path), { recursive: true });
      await fs.writeFile(input.path, input.content ?? "", "utf8");
      return textResult("Wrote " + input.path);
    }

    if (name === "edit_file") {
      let content = await fs.readFile(input.path, "utf8");
      const edits = Array.isArray(input.edits) ? input.edits : [];
      for (const edit of edits) {
        const oldText = edit?.oldText ?? "";
        if (!content.includes(oldText)) {
          return textResult(
            `oldText not found in ${input.path}: ${JSON.stringify(oldText).slice(0, 200)}`,
          );
        }
        content = content.replace(oldText, edit?.newText ?? "");
      }
      await fs.writeFile(input.path, content, "utf8");
      return textResult(`Edited ${input.path} (${edits.length} replacement(s))`);
    }

    if (name === "create_directory") {
      await fs.mkdir(input.path, { recursive: true });
      return textResult("Created " + input.path);
    }

    if (name === "search_files") {
      const searchPath = input.path || ROOT;
      const pattern = input.pattern || "*";
      const excludes = Array.isArray(input.excludePatterns)
        ? input.excludePatterns
        : [];
      const excludePred = excludes
        .map((p) => `-not -path ${quote("./" + p)} -not -path ${quote(p)}`)
        .join(" ");
      const globResult = await run(
        `cd ${quote(searchPath)} && find . -type f ${excludePred} 2>/dev/null | head -2000`,
      );
      const normalized = pattern.replace(/\*\*\//g, "").replace(/\*\*/g, "*");
      const lines = (globResult.out || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((line) => {
          const rel = line.replace(/^\.\//, "");
          if (normalized.startsWith("*.")) {
            return rel.endsWith(normalized.slice(1));
          }
          if (normalized.includes("*")) {
            const re = new RegExp(
              "^" +
                normalized
                  .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                  .replace(/\*/g, ".*") +
                "$",
            );
            return re.test(rel) || re.test(line);
          }
          return rel.includes(normalized) || line.includes(normalized);
        });
      return textResult(lines.join("\n") || "(no matches)");
    }

    if (name === "npm_install") {
      const result = await run("cd " + quote(ROOT) + " && npm install", 300_000);
      return textResult(result.out || `npm install exit ${result.code}`);
    }

    if (name === "npm_run_lint") {
      const result = await run("cd " + quote(ROOT) + " && npm run lint", 180_000);
      return textResult(result.out || `lint exit ${result.code}`);
    }

    if (name === "git_commit_and_push") {
      const message = input.message || "committed";
      const result = await run(
        [
          "cd " + quote(ROOT),
          "git add -A",
          `git -c user.email=kayra@local -c user.name=Kayra commit -m ${quote(message)} --allow-empty`,
        ].join(" && "),
      );
      return textResult(result.out || `commit exit ${result.code}`);
    }

    if (name === "exec") {
      const cwd = input.cwd || ROOT;
      const command = input.command || "";
      const result = await run(`cd ${quote(cwd)} && ${command}`);
      return textResult(result.out || `exit ${result.code}`);
    }

    return textResult(`Unknown tool: ${name}`);
  } catch (error) {
    return textResult(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : "";
}

function proxyToExpo(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${EXPO_PORT}` };
  delete headers["host"];
  headers.host = `127.0.0.1:${EXPO_PORT}`;

  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: EXPO_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      const outHeaders = { ...up.headers };
      delete outHeaders["x-frame-options"];
      delete outHeaders["content-security-policy"];
      delete outHeaders["X-Frame-Options"];
      delete outHeaders["Content-Security-Policy"];
      res.writeHead(up.statusCode || 502, outHeaders);
      up.pipe(res);
    },
  );

  upstream.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("content-type", "text/plain");
      res.end("Expo preview is not ready");
    }
  });

  req.pipe(upstream);
}

/**
 * HTTP entry used by the bridge server and by unit tests.
 */
export async function handleHttpRequest(req, res) {
  const url = req.url || "/";

  if (req.method === "GET" && url.startsWith("/__kayra/health")) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain");
    res.end("ok");
    return;
  }

  if (req.method === "POST" && url.startsWith("/__kayra/tool")) {
    const expected = process.env.KAYRA_TOKEN || TOKEN;
    const provided = bearerToken(req);
    if (!expected || provided !== expected) {
      res.statusCode = 401;
      res.setHeader("content-type", "text/plain");
      res.end("unauthorized");
      return;
    }

    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString("utf8") || "{}");
      const result = await handleTool(body.name, body.arguments || {});
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify(
          textResult(error instanceof Error ? error.message : String(error)),
        ),
      );
    }
    return;
  }

  proxyToExpo(req, res);
}

function startServer() {
  const server = http.createServer((req, res) => {
    handleHttpRequest(req, res).catch((error) => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(String(error));
      }
    });
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`kayra-bridge listening on ${PORT}`);
  });
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  startServer();
}
