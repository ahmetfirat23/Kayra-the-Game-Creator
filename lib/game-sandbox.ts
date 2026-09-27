import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxName } from "./sandbox-lifecycle.ts";

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

async function installTemplate(sandbox: SandboxVm): Promise<boolean> {
  const installed = await commandOk(
    sandbox,
    "test -d /template/node_modules/three && test -d /template/node_modules/@react-three/fiber && test -d /template/node_modules/expo-gl",
  );
  if (installed) return false;

  const prepare = await sandbox.runCommand(
    "bash",
    [
      "-lc",
      [
        'if [ ! -w /template ] 2>/dev/null; then sudo mkdir -p /template /opt && sudo chown -R "$(id -un)" /template /opt; fi',
        "mkdir -p /template /opt",
        `if [ ! -f /template/package.json ]; then git clone --depth 1 ${TEMPLATE_REPO} /template; fi`,
        "cd /template && npm install three @react-three/fiber @react-three/drei @react-three/rapier zustand @use-gesture/react",
        "cd /template && CI=1 npx expo install expo-gl expo-av expo-haptics",
      ].join(" && "),
    ],
    // The ensure route ends at 300s, and sandbox startup still has to fit after this.
    { timeoutMs: 200_000 },
  );

  if (prepare.exitCode !== 0) {
    const stderr = await prepare.stderr();
    const stdout = await prepare.stdout();
    throw new Error(
      `Could not prepare the game template. ${stderr || stdout}`.slice(0, 700),
    );
  }
  return true;
}

/** Quiet first screen until Kayra overwrites `/template/app/(tabs)/index.tsx`. */
const HOLDING_PAGE = `import { StyleSheet, Text, View } from 'react-native';

export default function BuildingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.tree}>🌳</Text>
      <Text style={styles.message}>
        Kayra is building your game. When it's done, it will show here.
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
    backgroundColor: '#f7f7f5',
  },
  tree: {
    fontSize: 48,
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#333',
    maxWidth: 320,
  },
});
`;

/** Single-screen layout so the Expo starter Explore tab cannot appear. */
const HOLDING_TABS_LAYOUT = `import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
`;

async function writeHoldingPage(sandbox: SandboxVm): Promise<void> {
  await sandbox.writeFiles([
    {
      path: "/template/app/(tabs)/index.tsx",
      content: HOLDING_PAGE,
      mode: 0o644,
    },
    {
      path: "/template/app/(tabs)/_layout.tsx",
      content: HOLDING_TABS_LAYOUT,
      mode: 0o644,
    },
  ]);
}

async function ensureProcesses(sandbox: SandboxVm, token: string): Promise<void> {
  await sandbox.writeFiles([
    {
      path: "/opt/kayra-bridge.mjs",
      content: bridgeSource(),
      mode: 0o644,
    },
  ]);

  const bridgeUp = await commandOk(
    sandbox,
    "curl -sf -o /dev/null http://127.0.0.1:3000/__kayra/health",
  );
  if (!bridgeUp) {
    // Detached long-running process: never set timeoutMs (SDK kills on timeout).
    await sandbox.runCommand({
      cmd: "node",
      args: ["/opt/kayra-bridge.mjs"],
      detached: true,
      env: { KAYRA_TOKEN: token },
    });
  }

  const expoUp = await commandOk(
    sandbox,
    "curl -sf -o /dev/null http://127.0.0.1:19006",
  );
  if (!expoUp) {
    await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-lc",
        "cd /template && CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 19006 --host lan",
      ],
      detached: true,
    });
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      await commandOk(
        sandbox,
        "curl -sf -o /dev/null http://127.0.0.1:3000/__kayra/health",
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
  const { client, existingToken } = options;
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
  if (installedNow) {
    // Metro keeps a failed resolve until Expo starts again.
    await sandbox.runCommand(
      "bash",
      ["-lc", "pkill -f 'expo start' || true"],
      { timeoutMs: 15_000 },
    );
    // Replace the Expo starter before Expo serves so the iframe is quiet.
    await writeHoldingPage(sandbox);
  }

  const token = existingToken || randomBytes(32).toString("hex");
  await ensureProcesses(sandbox, token);

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
