import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.KAYRA_TOKEN || "";
const EXPO_PORT = 19006;
const PORT = Number(process.env.KAYRA_BRIDGE_PORT || 3000);
const ROOT = process.env.KAYRA_ROOT || "/template";

/** Health body. Older bridges answer a previous token and get replaced. */
export const BRIDGE_HEALTH = "ok 16";
export const MAX_READ_LINES = 160;
export const MAX_READ_CHARS = 12_000;
export const RESTART_SCRIPT_PATH = "/tmp/kayra-restart-preview.sh";
const RESTART_LOG_PATH = "/tmp/kayra-restart-preview.log";
const EXPO_LOCK_PATH = "/tmp/kayra-expo.lock";

let lastCompileError = "";

export function noteCompileError(error) {
  lastCompileError = String(error || "").slice(0, 4000);
}

export function currentCompileError() {
  return lastCompileError;
}

export function fileExcerpt(content, startLine = 1, endLine) {
  const lines = String(content).split("\n");
  const start = Math.max(1, Math.min(lines.length, Math.floor(Number(startLine) || 1)));
  const requestedEnd = Number.isFinite(Number(endLine)) ? Math.floor(Number(endLine)) : start + MAX_READ_LINES - 1;
  const end = Math.max(start, Math.min(lines.length, requestedEnd, start + MAX_READ_LINES - 1));
  let output = "";
  let last = start - 1;
  for (let index = start - 1; index < end; index++) {
    const line = `${index + 1}: ${lines[index]}\n`;
    if (output.length + line.length > MAX_READ_CHARS) break;
    output += line;
    last = index + 1;
  }
  return `${output}[lines ${start}-${last} of ${lines.length}${last < lines.length ? `; continue at ${last + 1}` : ""}]`;
}

export async function searchCode(root, query, limit = 30) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return "Provide a search query.";
  const matches = [];
  let scanned = 0;
  const skip = new Set(["node_modules", ".git", ".expo", ".cache", "dist", "build"]);
  async function walk(dir) {
    if (matches.length >= limit || scanned >= 500) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (matches.length >= limit || scanned >= 500) break;
      if (skip.has(entry.name) || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && /\.(tsx?|jsx?|json|md|css)$/.test(entry.name)) {
        scanned++;
        const stat = await fs.stat(full);
        if (stat.size > 200_000) continue;
        const lines = (await fs.readFile(full, "utf8")).split("\n");
        for (let i = 0; i < lines.length && matches.length < limit; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            matches.push(`${full}:${i + 1}: ${lines[i].trim().slice(0, 180)}`);
          }
        }
      }
    }
  }
  await walk(root);
  return matches.join("\n") || "(no matches)";
}

/** Metro's failure page. Null when this response is not a compile error. */
export function compileErrorText(status, body) {
  const code = Number(status) || 0;
  if (code < 400) return null;
  const sample = String(body || "").slice(0, 8000);
  if (
    !/Unable to resolve module|SyntaxError|TransformError|Bundling failed|UnableToResolveError|Failed to compile/.test(
      sample,
    )
  ) {
    return null;
  }
  return sample.slice(0, 4000);
}

/** Bundle requests are compiler output, so any failed bundle is actionable. */
export function previewErrorText(status, body, isBundle = false, isDocument = false) {
  const known = compileErrorText(status, body);
  if (known) return known;
  const code = Number(status) || 0;
  if (isDocument && code >= 500) {
    const detail = String(body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
    return `Preview document failed with HTTP ${code}. ${detail}`.trim();
  }
  if (!isBundle || code < 400) return null;
  const sample = String(body || "").trim().slice(0, 4000);
  return sample || `Metro bundle request failed with status ${code}`;
}

export function fixingPreviewPage() {
  return `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="2">
<title>Kayra</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: linear-gradient(135deg, #F0E6FA 0%, #FAFBFC 48%, #E8F4FC 100%);
    color: #4A5568;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; gap: 14px;
  }
  .tree { font-size: 64px; line-height: 1; }
  .word { margin: 0; font-size: 40px; line-height: 1; font-weight: 700; color: #7EB8D8; }
  p { margin: 0; max-width: 220px; font-size: 15px; line-height: 1.45; font-weight: 500; color: #718096; }
</style>
<main>
  <div class="tree">🌳</div>
  <div class="word">Kayra</div>
  <p>Kayra is fixing your game</p>
</main>`;
}

export function fixingPreviewScript() {
  return `document.open();document.write(${JSON.stringify(fixingPreviewPage())});document.close();`;
}

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

/**
 * The running bundler is `cli start`, not `expo start`, so a search for those
 * words leaves the old page up. Kill the port and any expo/metro process.
 * Brackets keep this command from matching itself.
 */
export function stopExpoShell() {
  return [
    "if command -v fuser >/dev/null 2>&1; then fuser -k 19006/tcp || true; fi",
    "pkill -f '[e]xpo' || true",
    "pkill -f '[m]etro' || true",
    "pkill -f '[c]li.*start.*19006' || true",
  ].join("; ");
}

export function waitForExpoDownShell() {
  return "for ((i=1; i<=20; i++)); do (echo > /dev/tcp/127.0.0.1/19006) >/dev/null 2>&1 || exit 0; sleep 0.25; done; exit 1";
}

export function waitForExpoUpShell() {
  return "for ((i=1; i<=20; i++)); do (echo > /dev/tcp/127.0.0.1/19006) >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1";
}

/** Detached Expo restart. The script path does not contain "expo", so pkill cannot match it. */
export function expoRestartScript() {
  return `#!/bin/bash
${stopExpoShell()}
rm -rf /template/.expo /template/node_modules/.cache /tmp/metro-* /tmp/haste-map-*
sleep 0.4
cd /template
export CI=1
export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS=--max-old-space-size=1536
if command -v flock >/dev/null 2>&1; then
  exec flock -n ${EXPO_LOCK_PATH} npx expo start --clear --web --port 19006 --host lan > ${RESTART_LOG_PATH} 2>&1
fi
exec npx expo start --clear --web --port 19006 --host lan > ${RESTART_LOG_PATH} 2>&1
`;
}

/** @param {{KAYRA_RESTART_EXPO?: string}} [env] */
export function commitRestartsPreview(env = process.env) {
  return env.KAYRA_RESTART_EXPO === "1";
}

/** Stop the preview before the commit tool returns, then start it again. */
/** @param {{KAYRA_RESTART_EXPO?: string}} [env] */
export function expoRestartOrder(env = process.env) {
  if (!commitRestartsPreview(env)) return [];
  return ["stop", "start"];
}

async function restartExpoAfterCommit() {
  if (!commitRestartsPreview()) return "not-managed";
  await run(stopExpoShell());
  await run("rm -rf /template/.expo /template/node_modules/.cache /tmp/metro-* /tmp/haste-map-*");
  const stopped = await run(waitForExpoDownShell(), 15_000);
  if (stopped.code !== 0) throw new Error("Previous Expo process did not stop.");
  await fs.writeFile(RESTART_SCRIPT_PATH, expoRestartScript(), "utf8");
  const child = spawn("bash", [RESTART_SCRIPT_PATH], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.unref();
  const listening = await run(waitForExpoUpShell(), 25_000);
  if (listening.code !== 0) {
    let alive = false;
    try {
      process.kill(child.pid, 0);
      alive = true;
    } catch {
      // The restart process exited before opening the port.
    }
    if (alive) return "starting";
    let detail = "Expo exited after the game was committed.";
    try {
      const log = (await fs.readFile(RESTART_LOG_PATH, "utf8")).trim();
      if (log) detail += `\n${log.slice(-3500)}`;
    } catch {
      // Expo may have failed before creating its log.
    }
    noteCompileError(detail);
    throw new Error(detail);
  }
  return "listening";
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
</main>
<div data-kayra-preview-waiting="1" hidden></div>
<script>
  let checking = false;
  async function checkPreview() {
    if (checking) return;
    checking = true;
    try {
      const response = await fetch(location.href, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      const html = await response.text();
      if (!html.includes("data-kayra-preview-waiting")) location.reload();
    } catch {} finally { checking = false; }
  }
  setInterval(checkPreview, 3000);
  setTimeout(() => location.reload(), 45000);
</script>`;
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
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return textResult(entries.slice(0, 100).map((entry) =>
        `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`,
      ).join("\n") + (entries.length > 100 ? "\n(more entries; use search_files)" : ""));
    }

    if (name === "read_file") {
      const content = await fs.readFile(input.path, "utf8");
      return textResult(fileExcerpt(content, input.startLine, input.endLine));
    }

    if (name === "search_code") {
      return textResult(await searchCode(input.path || ROOT, input.query));
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
        `cd ${quote(searchPath)} && find . -type f ${excludePred} 2>/dev/null | head -1000`,
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
      return textResult(lines.slice(0, 100).join("\n") || "(no matches)");
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
      if (result.code !== 0) {
        return textResult(`Error committing: ${result.out || `git exited ${result.code}`}`);
      }
      // Metro keeps the first bundle of app/(tabs) and ignores later writes.
      // Restarting Expo after the commit makes the preview read the game files.
      try {
        const preview = await restartExpoAfterCommit();
        return textResult(`Committed changes successfully. Preview ${preview === "starting" ? "is still starting; it will appear when Expo finishes bundling" : "restart requested"}.`);
      } catch (error) {
        return textResult(
          `Committed changes successfully. Preview restart failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (name === "exec") {
      const cwd = input.cwd || ROOT;
      const command = input.command || "";
      const refused = refusedShell(command);
      if (refused) return textResult(refused);
      const result = await run(`cd ${quote(cwd)} && ${command}`);
      return textResult((result.out || `exit ${result.code}`).slice(0, MAX_READ_CHARS));
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

function expoIsListening() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: EXPO_PORT });
    socket.setTimeout(2_000);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", () => resolve(false));
  });
}

/** @param {Record<string, string>} [upstream] */
export function previewResponseHeaders(upstream = {}) {
  const out = { ...upstream };
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase();
    if (
      lower === "x-frame-options" ||
      lower === "content-security-policy" ||
      lower === "cache-control" ||
      lower === "etag" ||
      lower === "last-modified" ||
      lower === "expires"
    ) {
      delete out[key];
    }
  }
  out["cache-control"] = "no-store";
  return out;
}

function proxyToExpo(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${EXPO_PORT}` };
  delete headers["host"];
  headers.host = `127.0.0.1:${EXPO_PORT}`;
  headers["cache-control"] = "no-cache";
  delete headers["if-none-match"];
  delete headers["If-None-Match"];
  delete headers["if-modified-since"];
  delete headers["If-Modified-Since"];

  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: EXPO_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      const status = up.statusCode || 502;
      const type = String(up.headers["content-type"] || up.headers["Content-Type"] || "");
      const url = String(req.url || "");
      const bundle = /\.bundle|platform=web/.test(url);
      const document = !bundle && (type.includes("text/html") || String(req.headers.accept || "").includes("text/html"));
      if (status < 400) {
        if (bundle) lastCompileError = "";
        res.writeHead(status, previewResponseHeaders(up.headers));
        up.pipe(res);
        return;
      }
      const chunks = [];
      up.on("data", (chunk) => chunks.push(chunk));
      up.on("end", () => {
        if (res.headersSent) return;
        const body = Buffer.concat(chunks);
        const error = previewErrorText(status, body.toString("utf8"), bundle, document);
        if (!error) {
          res.writeHead(status, previewResponseHeaders(up.headers));
          res.end(body);
          return;
        }
        noteCompileError(error);
        const asScript = bundle || type.includes("javascript") || type.includes("json");
        if (asScript) {
          res.writeHead(200, {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store",
          });
          res.end(fixingPreviewScript());
          return;
        }
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(fixingPreviewPage());
      });
    },
  );

  upstream.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(currentCompileError() ? fixingPreviewPage() : previewWaitingPage());
    }
  });

  req.pipe(upstream);
}

/**
 * HTTP entry used by the bridge server and by unit tests.
 */
export async function handleHttpRequest(req, res) {
  const url = req.url || "/";

  if (req.method === "GET" && url.startsWith("/__kayra/compile-error")) {
    const expected = process.env.KAYRA_TOKEN || TOKEN;
    const provided = bearerToken(req);
    if (!expected || provided !== expected) {
      res.statusCode = 401;
      res.setHeader("content-type", "text/plain");
      res.end("unauthorized");
      return;
    }
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ error: currentCompileError() }));
    return;
  }

  if (req.method === "GET" && url.startsWith("/__kayra/health")) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain");
    res.end(BRIDGE_HEALTH);
    return;
  }

  if (req.method === "GET" && url.startsWith("/__kayra/preview-health")) {
    const expected = process.env.KAYRA_TOKEN || TOKEN;
    const provided = bearerToken(req);
    if (!expected || provided !== expected) {
      res.statusCode = 401;
      res.setHeader("content-type", "text/plain");
      res.end("unauthorized");
      return;
    }
    const ready = await expoIsListening();
    res.statusCode = ready ? 200 : 503;
    res.setHeader("content-type", "text/plain");
    res.setHeader("cache-control", "no-store");
    res.end(ready ? "ready" : "unavailable");
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
      console.error("Preview bridge request failed:", error);
      if (!res.headersSent) {
        res.statusCode = 200;
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(previewWaitingPage());
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
