import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.KAYRA_TOKEN || "";
const EXPO_PORT = 19006;
const PORT = Number(process.env.KAYRA_BRIDGE_PORT || 3000);
const ROOT = process.env.KAYRA_ROOT || "/template";

/** Health body. Older bridges answer "ok" and get replaced. */
export const BRIDGE_HEALTH = "ok 4";

function bareInstall(command) {
  const parts = String(command ?? "").toLowerCase().split(/&&|\|\||;|\n/);
  return parts.some((part) => {
    const trimmed = part.trim();
    if (/\bnpm\s+ci\b/.test(trimmed) || /\byarn\s+install\b/.test(trimmed)) {
      return true;
    }
    const match = trimmed.match(/\b(?:npm|pnpm)\s+(?:install|i)\b(.*)$/);
    if (!match) return false;
    const packages = match[1]
      .trim()
      .split(/\s+/)
      .filter((token) => token && !token.startsWith("-"));
    return packages.length === 0;
  });
}

export function refusedShell(command) {
  const lower = String(command ?? "").toLowerCase();
  if (lower.includes("reset-project")) {
    return "reset-project deletes the app. Do not run it. Edit the game files instead.";
  }
  if (/\bexpo\s+lint\b|\bnpm\s+run\s+lint\b/.test(lower)) {
    return "Lint is not part of the game preview. Do not run it.";
  }
  if (
    /\bexpo\s+start\b|\bnpm\s+run\s+(dev|start|web|android|ios)\b/.test(lower)
  ) {
    return "The game preview is already running. Do not start Expo or npm run dev.";
  }
  if (bareInstall(lower)) {
    return "The template and 3D libraries are already installed. Do not run a full install. Pass a package name to npmInstall only when adding a new package.";
  }
  return null;
}

/** Detached Expo restart. The script path does not contain "expo start", so pkill cannot match it. */
export function expoRestartScript() {
  return `#!/bin/bash
pkill -f 'expo start' || true
sleep 0.4
cd /template
export CI=1
export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS=--max-old-space-size=1536
exec npx expo start --web --port 19006 --host lan
`;
}

export function commitRestartsPreview(env = process.env) {
  return env.KAYRA_RESTART_EXPO === "1";
}

async function restartExpoAfterCommit() {
  if (!commitRestartsPreview()) return;
  const scriptPath = "/tmp/kayra-restart-expo.sh";
  await fs.writeFile(scriptPath, expoRestartScript(), "utf8");
  const child = spawn("bash", [scriptPath], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export function layoutTouchPath(writtenPath) {
  const normalized = String(writtenPath || "");
  if (!normalized.includes("(tabs)")) return null;
  const root = normalized.split("/app/")[0] || "/template";
  return root + "/app/_layout.tsx";
}

async function touchLayout(writtenPath) {
  const layout = layoutTouchPath(writtenPath);
  if (!layout) return;
  const now = new Date();
  try {
    await fs.utimes(layout, now, now);
  } catch {
    // The app root layout is not there yet.
  }
}

export function previewWaitingPage() {
  return `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="2">
<title>Starting</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: linear-gradient(135deg, #F0E6FA 0%, #FAFBFC 48%, #E8F4FC 100%);
    color: #4A5568;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .blob { position: fixed; z-index: 0; border-radius: 9999px; filter: blur(48px); pointer-events: none; }
  .lavender { width: 240px; height: 240px; background: #D4B8E8; opacity: 0.55; top: -60px; left: -40px; }
  .blue { width: 280px; height: 280px; background: #A8D4E6; opacity: 0.5; right: -70px; bottom: -80px; }
  main {
    position: fixed;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 14px;
    padding: 32px;
  }
  .tree { font-size: 64px; line-height: 1; }
  .word {
    margin: 0;
    font-size: 40px;
    line-height: 1;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #7EB8D8;
  }
  p {
    margin: 0;
    max-width: 220px;
    font-size: 15px;
    line-height: 1.45;
    font-weight: 500;
    color: #718096;
  }
  @media (prefers-color-scheme: dark) {
    body { background: linear-gradient(135deg, #1A202C 0%, #2D3748 100%); }
    .word { color: #A8D4E6; }
    p { color: #A0AEC0; }
    .blob { opacity: 0.28; }
  }
</style>
<div class="blob lavender"></div>
<div class="blob blue"></div>
<main>
  <div class="tree">🌳</div>
  <div class="word">Kayra</div>
  <p>Starting your game</p>
</main>`;
}

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
      await touchLayout(input.path);
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
      await touchLayout(input.path);
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
      const packages = Array.isArray(input.packages)
        ? input.packages.filter(
            (pkg) =>
              typeof pkg === "string" && /^[@a-z0-9][a-z0-9._/-]*$/i.test(pkg),
          )
        : [];
      if (packages.length === 0) {
        return textResult(
          "The template and 3D libraries are already installed. Pass a package name only when adding one that is not already there.",
        );
      }
      const result = await run(
        "cd " +
          quote(ROOT) +
          " && npm install " +
          packages.map(quote).join(" "),
        180_000,
      );
      return textResult(result.out || `npm install exit ${result.code}`);
    }

    if (name === "npm_run_lint") {
      return textResult("Lint is not part of the game preview. Do not run it.");
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
      // Metro keeps the first bundle of app/(tabs) and ignores later writes.
      // Restarting Expo after the commit makes the preview read the game files.
      await restartExpoAfterCommit();
      return textResult(result.out || `commit exit ${result.code}`);
    }

    if (name === "exec") {
      const cwd = input.cwd || ROOT;
      const command = input.command || "";
      const refused = refusedShell(command);
      if (refused) return textResult(refused);
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
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(previewWaitingPage());
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
    res.end(BRIDGE_HEALTH);
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
