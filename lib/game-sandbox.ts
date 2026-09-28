import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyTextEdits,
  includesGameScreen,
  type FinishedGame,
} from "./finished-game.ts";
import { sandboxName } from "./sandbox-lifecycle.ts";
import { BRIDGE_HEALTH } from "./kayra-bridge.mjs";

export const SESSION_TIMEOUT_MS = 10 * 60 * 1000;
export const VCPUS = 1;
export const BRIDGE_PORT = 3000;
export const TEMPLATE_REPO = "https://github.com/freestyle-sh/freestyle-expo.git";
export const TEMPLATE_DIR = "/template";

export type CommandResult = {
  exitCode: number;
  stdout: () => Promise<string>;
  stderr: () => Promise<string>;
};

export type RunCommandParams = {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  detached?: boolean;
  timeoutMs?: number;
};

export type SandboxVm = {
  delete(): Promise<void>;
  extendTimeout(duration: number): Promise<void>;
  runCommand(
    command: string | RunCommandParams,
    args?: string[],
    opts?: { timeoutMs?: number },
  ): Promise<CommandResult>;
  writeFiles(
    files: Array<{ path: string; content: string | Uint8Array; mode?: number }>,
  ): Promise<void>;
  domain(port: number): string;
};

export type GetOrCreateParams = {
  name: string;
  ports: number[];
  timeout: number;
  persistent: boolean;
  resources: { vcpus: number };
};

export type SandboxClient = {
  getOrCreate(params: GetOrCreateParams): Promise<SandboxVm>;
  get(params: { name: string }): Promise<SandboxVm | null>;
};

export type GameSandboxOptions = {
  client: SandboxClient;
  existingToken?: string | null;
  /** Files from the last successful commit. Written before Expo starts. */
  game?: FinishedGame | null;
};

export type EnsureResult = {
  previewUrl: string;
  execUrl: string;
  token: string;
};

export type DownloadResult =
  | { ok: true; data: string; filename: string }
  | { ok: false; reason: "not_found" };

function bridgeSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "kayra-bridge.mjs"),
    join(process.cwd(), "lib", "kayra-bridge.mjs"),
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      // try next
    }
  }
  throw new Error("Could not read lib/kayra-bridge.mjs");
}

async function commandOk(sandbox: SandboxVm, shell: string): Promise<boolean> {
  const result = await sandbox.runCommand("bash", ["-lc", shell], {
    timeoutMs: 15_000,
  });
  return result.exitCode === 0;
}

async function commandOutput(sandbox: SandboxVm, shell: string): Promise<string> {
  const result = await sandbox.runCommand("bash", ["-lc", shell], {
    timeoutMs: 15_000,
  });
  return (await result.stdout()).trim();
}

export function expoStartShell(): string {
  const expo =
    "env CI=1 EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--max-old-space-size=1536 npx expo start --clear --web --port 19006 --host lan";
  return `cd /template
if command -v flock >/dev/null 2>&1; then
  exec flock -n /tmp/kayra-expo.lock ${expo}
fi
exec ${expo}`;
}

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export const HOLDING_SENTENCE =
  "Kayra is building your game. When it's done, it will show here.";

/** Directory presence is not enough: a failed extract can leave package.json without its entry. */
export const TEMPLATE_READY_SHELL =
  "test -d /template/node_modules/three && test -d /template/node_modules/@react-three/fiber && test -d /template/node_modules/expo-gl && test -f /template/node_modules/expo-modules-core/src/index.ts";

const BASE_PACKAGES = [
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  "@react-three/rapier",
  "zustand",
  "@use-gesture/react",
  "expo-gl",
  "expo-av",
  "expo-haptics",
];

function installFailureText(stderr: string, stdout: string): string {
  const text = [stderr, stdout].filter(Boolean).join("\n").trim();
  const errors = text.split("\n").filter((line) => /npm error|ERR!/i.test(line));
  const useful = errors.length > 0 ? errors.join("\n") : text;
  return useful.slice(-700);
}

export function templateInstallShell(): string {
  const body = [
    'if [ ! -w /template ] 2>/dev/null; then sudo mkdir -p /template /opt && sudo chown -R "$(id -un)" /template /opt; fi',
    "mkdir -p /template /opt",
    `if [ ! -f /template/package.json ]; then git clone --depth 1 ${TEMPLATE_REPO} /template; fi`,
    `if ${TEMPLATE_READY_SHELL}; then exit 0; fi`,
    "cd /template",
    "if [ -d node_modules ] && [ ! -f node_modules/expo-modules-core/src/index.ts ]; then rm -rf node_modules; fi",
    "npm install three @react-three/fiber @react-three/drei @react-three/rapier zustand @use-gesture/react",
    "CI=1 npx expo install expo-gl expo-av expo-haptics",
  ].join(" && ");
  const locked = `flock -w 170 /tmp/kayra-template.lock bash -lc ${shellQuote(body)}`;
  return `if command -v flock >/dev/null 2>&1; then ${locked}; else bash -lc ${shellQuote(body)}; fi`;
}

/** Reinstall packages the agent added, when this machine does not have them yet. */
export function extraPackageInstallShell(packages: string[] | undefined): string | null {
  const extras = [...new Set(packages ?? [])].filter(
    (pkg) => /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(pkg) && !BASE_PACKAGES.includes(pkg),
  );
  if (extras.length === 0) return null;
  const list = extras.map(shellQuote).join(" ");
  return [
    "cd /template",
    `needed=""`,
    `for pkg in ${list}; do if [ ! -e "node_modules/$pkg" ]; then needed="$needed $pkg"; fi; done`,
    `if [ -n "$needed" ]; then npm install $needed && echo kayra-installed-packages; fi`,
  ].join(" && ");
}

async function installTemplate(sandbox: SandboxVm): Promise<boolean> {
  const installed = await commandOk(sandbox, TEMPLATE_READY_SHELL);
  if (installed) return false;

  const prepare = await sandbox.runCommand("bash", ["-lc", templateInstallShell()], {
    // The ensure route ends at 300s, and sandbox startup still has to fit after this.
    timeoutMs: 200_000,
  });

  if (prepare.exitCode !== 0) {
    const stderr = await prepare.stderr();
    const stdout = await prepare.stdout();
    throw new Error(
      `Could not prepare the game template. ${installFailureText(stderr, stdout)}`,
    );
  }
  return true;
}

async function installGamePackages(
  sandbox: SandboxVm,
  packages: string[] | undefined,
): Promise<boolean> {
  const shell = extraPackageInstallShell(packages);
  if (!shell) return false;
  const result = await sandbox.runCommand("bash", ["-lc", shell], { timeoutMs: 180_000 });
  const stdout = await result.stdout();
  if (result.exitCode !== 0) {
    const stderr = await result.stderr();
    throw new Error(
      `Could not install game dependencies. ${installFailureText(stderr, stdout)}`,
    );
  }
  return stdout.includes("kayra-installed-packages");
}

/** Quiet first screen until Kayra overwrites `/template/app/(tabs)/index.tsx`. */
const HOLDING_PAGE = `import { StyleSheet, Text, useColorScheme, View } from 'react-native';

export default function BuildingScreen() {
  const dark = useColorScheme() === 'dark';
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <View style={[styles.blob, styles.blobLavender]} />
      <View style={[styles.blob, styles.blobBlue]} />
      <View style={[styles.blob, styles.blobGreen]} />
      <Text style={styles.tree}>🌳</Text>
      <Text style={[styles.word, dark && styles.wordDark]}>Kayra</Text>
      <Text style={[styles.message, dark && styles.messageDark]}>
        ${HOLDING_SENTENCE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F0E6FA',
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: '#1A202C',
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobLavender: {
    width: 220,
    height: 220,
    backgroundColor: '#D4B8E8',
    opacity: 0.45,
    top: -40,
    left: -30,
  },
  blobBlue: {
    width: 260,
    height: 260,
    backgroundColor: '#A8D4E6',
    opacity: 0.4,
    bottom: -50,
    right: -40,
  },
  blobGreen: {
    width: 160,
    height: 160,
    backgroundColor: '#B8E8C8',
    opacity: 0.35,
    top: 180,
    left: 40,
  },
  tree: {
    fontSize: 56,
    marginBottom: 8,
  },
  word: {
    fontSize: 28,
    fontWeight: '700',
    color: '#7EB8D8',
    marginBottom: 8,
  },
  wordDark: {
    color: '#A8D4E6',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#4A5568',
    maxWidth: 320,
  },
  messageDark: {
    color: '#E2E8F0',
  },
});
`;

/** Keep the upstream route group for saved games, without its starter tabs. */
const GAME_LAYOUT = `import { Slot } from 'expo-router';

export default function GameLayout() {
  return <Slot />;
}
`;

/** Optional example; it is outside app/ so it never appears as a preview route. */
const TAP_GAME_EXAMPLE = `import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function TapGame() {
  const [score, setScore] = useState(0);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Tap Garden</Text>
      <Text style={styles.score}>Score: {score}</Text>
      <Pressable accessibilityRole="button" onPress={() => setScore((value) => value + 1)} style={styles.button}>
        <Text style={styles.buttonText}>Grow 🌱</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: '#F0E6FA' },
  title: { fontSize: 32, fontWeight: '700', color: '#273249' },
  score: { fontSize: 22, color: '#273249' },
  button: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: 16, backgroundColor: '#5A4292' },
  buttonText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
});
`;

function gameIncludesPath(game: FinishedGame | null | undefined, filePath: string): boolean {
  return Boolean(game?.files.some((file) => file.path === filePath) ||
    game?.diskEdits.some((edit) => edit.path === filePath));
}

async function prepareStarterFiles(
  sandbox: SandboxVm,
  game: FinishedGame | null | undefined,
): Promise<void> {
  const files: Array<{ path: string; content: string; mode: number }> = [];
  if (!includesGameScreen(game)) {
    files.push({ path: "/template/app/(tabs)/index.tsx", content: HOLDING_PAGE, mode: 0o644 });
  }
  if (!gameIncludesPath(game, "/template/app/(tabs)/_layout.tsx")) {
    files.push({ path: "/template/app/(tabs)/_layout.tsx", content: GAME_LAYOUT, mode: 0o644 });
  }
  files.push({ path: "/template/examples/tap-game.tsx", content: TAP_GAME_EXAMPLE, mode: 0o644 });
  await sandbox.runCommand("bash", ["-lc", "mkdir -p /template/examples"], { timeoutMs: 15_000 });
  await sandbox.writeFiles(files);
  if (!gameIncludesPath(game, "/template/app/(tabs)/explore.tsx")) {
    await sandbox.runCommand("bash", ["-lc", "rm -f '/template/app/(tabs)/explore.tsx'"], { timeoutMs: 15_000 });
  }
}

async function stopExpo(sandbox: SandboxVm): Promise<void> {
  await sandbox.runCommand(
    "bash",
    [
      "-lc",
      "if command -v fuser >/dev/null 2>&1; then fuser -k 19006/tcp || true; fi; pkill -f '[e]xpo' || true; pkill -f '[m]etro' || true; pkill -f '[c]li.*start.*19006' || true",
    ],
    { timeoutMs: 15_000 },
  );
  await sandbox.runCommand(
    "bash",
    [
      "-lc",
      "rm -rf /template/.expo /template/node_modules/.cache /tmp/metro-* /tmp/haste-map-*",
    ],
    { timeoutMs: 15_000 },
  );
}

async function isHoldingPage(sandbox: SandboxVm): Promise<boolean> {
  return commandOk(
    sandbox,
    `grep -F -q ${shellQuote(HOLDING_SENTENCE)} ${shellQuote("/template/app/(tabs)/index.tsx")}`,
  );
}

async function readSandboxText(
  sandbox: SandboxVm,
  filePath: string,
): Promise<string | null> {
  const result = await sandbox.runCommand(
    "bash",
    ["-lc", `base64 -w 0 ${shellQuote(filePath)}`],
    { timeoutMs: 15_000 },
  );
  if (result.exitCode !== 0) return null;
  const encoded = (await result.stdout()).replace(/\s+/g, "");
  if (!encoded) return null;
  return Buffer.from(encoded, "base64").toString("utf8");
}

async function restoreFinishedGame(
  sandbox: SandboxVm,
  game: FinishedGame,
): Promise<void> {
  if (game.files.length > 0) {
    const dirs = [
      ...new Set(
        game.files.map((file) => file.path.split("/").slice(0, -1).join("/")),
      ),
    ].filter(Boolean);
    if (dirs.length > 0) {
      await sandbox.runCommand(
        "bash",
        ["-lc", dirs.map((dir) => `mkdir -p ${shellQuote(dir)}`).join(" && ")],
        { timeoutMs: 15_000 },
      );
    }
    await sandbox.writeFiles(
      game.files.map((file) => ({
        path: file.path,
        content: file.content,
        mode: 0o644,
      })),
    );
  }

  for (const edit of game.diskEdits) {
    const current = await readSandboxText(sandbox, edit.path);
    if (current == null) continue;
    await sandbox.writeFiles([
      {
        path: edit.path,
        content: applyTextEdits(current, edit.edits),
        mode: 0o644,
      },
    ]);
  }
}

async function ensureProcesses(sandbox: SandboxVm, token: string, newToken: boolean): Promise<void> {
  await sandbox.writeFiles([
    {
      path: "/opt/kayra-bridge.mjs",
      content: bridgeSource(),
      mode: 0o644,
    },
  ]);

  const health = await commandOutput(
    sandbox,
    "curl -sf http://127.0.0.1:3000/__kayra/health || true",
  );
  const authorized = !newToken && await commandOk(
    sandbox,
    `curl -sf -o /dev/null -H ${shellQuote(`Authorization: Bearer ${token}`)} http://127.0.0.1:3000/__kayra/compile-error`,
  );
  // The bridge keeps its token in its process environment. A healthy process
  // can still hold the previous token when the session row was lost.
  if (!authorized || health !== BRIDGE_HEALTH) {
    await sandbox.runCommand("bash", ["-lc", "pkill -f '[n]ode /opt/kayra-bridge.mjs' || true"], {
      timeoutMs: 15_000,
    });
    await sandbox.runCommand({
      cmd: "node",
      args: ["/opt/kayra-bridge.mjs"],
      detached: true,
      env: { KAYRA_TOKEN: token, KAYRA_RESTART_EXPO: "1" },
    });
  }

  const expoUp = await commandOk(
    sandbox,
    "(echo > /dev/tcp/127.0.0.1/19006) >/dev/null 2>&1",
  );
  if (!expoUp) {
    await sandbox.runCommand({
      cmd: "bash",
      args: ["-lc", expoStartShell()],
      detached: true,
    });
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      await commandOk(
        sandbox,
        `curl -sf -o /dev/null -H ${shellQuote(`Authorization: Bearer ${token}`)} http://127.0.0.1:3000/__kayra/compile-error`,
      )
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "The game environment started, but its preview bridge did not become ready.",
  );
}

export async function ensureGameSandbox(
  chatId: string,
  options: GameSandboxOptions,
): Promise<EnsureResult> {
  const { client, existingToken, game } = options;
  const name = sandboxName(chatId);

  const sandbox = await client.getOrCreate({
    name,
    ports: [BRIDGE_PORT],
    timeout: SESSION_TIMEOUT_MS,
    persistent: false,
    resources: { vcpus: VCPUS },
  });

  // Named reuse keeps the original deadline. Adding time is refused once the
  // platform maximum is reached, and that must not block the preview.
  await extendSandboxTimeout(sandbox, SESSION_TIMEOUT_MS);

  const installedNow = await installTemplate(sandbox);
  const hasGame = Boolean(game && (game.files.length > 0 || game.diskEdits.length > 0));
  const bridgeHealth = await commandOutput(sandbox, "curl -sf http://127.0.0.1:3000/__kayra/health || true");
  const bridgeNeedsUpgrade = bridgeHealth !== BRIDGE_HEALTH;
  // A fresh template, or a machine still showing the placeholder, does not
  // have this chat's game. Put the committed files on disk before Expo starts.
  const shouldRestore =
    hasGame && (installedNow || (await isHoldingPage(sandbox)));

  if (installedNow || shouldRestore || bridgeNeedsUpgrade) {
    await stopExpo(sandbox);
  }

  if (installedNow || shouldRestore) {
    await prepareStarterFiles(sandbox, shouldRestore ? game : null);
  }

  if (shouldRestore && game) {
    await restoreFinishedGame(sandbox, game);
  }

  const extrasInstalled = await installGamePackages(sandbox, game?.packages);
  if (extrasInstalled) {
    await stopExpo(sandbox);
  }

  const newToken = !existingToken;
  const token = existingToken || randomBytes(32).toString("hex");
  await ensureProcesses(sandbox, token, newToken);

  const previewUrl = sandbox.domain(BRIDGE_PORT);
  return {
    previewUrl,
    execUrl: `${previewUrl}/__kayra/tool`,
    token,
  };
}

export async function extendSandboxTimeout(
  sandbox: SandboxVm,
  duration: number,
): Promise<void> {
  try {
    await sandbox.extendTimeout(duration);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/maximum execution timeout/i.test(message)) return;
    throw error;
  }
}

export async function deleteGameSandbox(
  chatId: string,
  options: { client: SandboxClient },
): Promise<void> {
  const sandbox = await options.client.get({ name: sandboxName(chatId) });
  if (!sandbox) return;
  try {
    await sandbox.delete();
  } catch {
    // Already gone or racing with another delete.
  }
}

export async function downloadGameArchive(
  chatId: string,
  options: { client: SandboxClient },
): Promise<DownloadResult> {
  const sandbox = await options.client.get({ name: sandboxName(chatId) });
  if (!sandbox) {
    return { ok: false, reason: "not_found" };
  }

  const result = await sandbox.runCommand(
    "bash",
    [
      "-lc",
      "cd /template && tar --exclude=node_modules --exclude=.git --exclude=.expo --exclude=.cache -czf /tmp/project.tar.gz . && base64 -w 0 /tmp/project.tar.gz",
    ],
    { timeoutMs: 120_000 },
  );

  if (result.exitCode !== 0) {
    const stderr = await result.stderr();
    throw new Error(stderr || "Could not archive the project");
  }

  return {
    ok: true,
    data: (await result.stdout()).trim(),
    filename: `game-project-${chatId.slice(0, 8)}.tar.gz`,
  };
}

/**
 * Production adapter around `@vercel/sandbox`.
 * Kept separate so unit tests inject a fake client without network or credentials.
 */
export function isSandboxGoneError(error: unknown): boolean {
  const status =
    (error as { response?: { status?: number } })?.response?.status ??
    (error as { status?: number })?.status;
  if (status === 404 || status === 410) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /SANDBOX_STOPPED|sandbox was stopped/i.test(message);
}

function sessionStatus(sandbox: SandboxVm): string | undefined {
  const status = (sandbox as { session?: { status?: string } }).session?.status;
  return typeof status === "string" ? status : undefined;
}

async function discardIfStopped(sandbox: SandboxVm): Promise<SandboxVm | null> {
  const status = sessionStatus(sandbox);
  if (status !== "stopped" && status !== "stopping") return sandbox;
  try {
    await sandbox.delete();
  } catch {
    // The stopped VM is already gone.
  }
  return null;
}

export function createVercelSandboxClient(): SandboxClient {
  return {
    async getOrCreate(params) {
      const { Sandbox } = await import("@vercel/sandbox");
      try {
        const sandbox = (await Sandbox.getOrCreate(params)) as unknown as SandboxVm;
        const live = await discardIfStopped(sandbox);
        if (live) return live;
        return (await Sandbox.create(params)) as unknown as SandboxVm;
      } catch (error) {
        if (!isSandboxGoneError(error)) throw error;
        return (await Sandbox.create(params)) as unknown as SandboxVm;
      }
    },
    async get(params) {
      const { Sandbox } = await import("@vercel/sandbox");
      try {
        const sandbox = (await Sandbox.get(params)) as unknown as SandboxVm;
        return discardIfStopped(sandbox);
      } catch (error) {
        if (isSandboxGoneError(error)) return null;
        throw error;
      }
    },
  };
}
