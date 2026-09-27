import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRIDGE_HEALTH } from "./kayra-bridge.mjs";
import {
  HOLDING_SENTENCE,
  SESSION_TIMEOUT_MS,
  deleteGameSandbox,
  downloadGameArchive,
  ensureGameSandbox,
  expoStartShell,
  isSandboxGoneError,
  type SandboxClient,
  type SandboxVm,
} from "./game-sandbox.ts";

function createFakeVm(overrides: Partial<SandboxVm> = {}): SandboxVm {
  return {
    delete: async () => {},
    extendTimeout: async () => {},
    runCommand: async () => ({ exitCode: 0, stdout: async () => "", stderr: async () => "" }),
    writeFiles: async () => {},
    domain: () => "https://preview.example",
    ...overrides,
  };
}

function createFakeClient(options: {
  getOrCreate?: SandboxClient["getOrCreate"];
  get?: SandboxClient["get"];
} = {}): {
  client: SandboxClient;
  getOrCreateCalls: unknown[];
  getCalls: unknown[];
  deleteCalls: number;
  extendTimeoutCalls: number[];
} {
  const getOrCreateCalls: unknown[] = [];
  const getCalls: unknown[] = [];
  const extendTimeoutCalls: number[] = [];
  let deleteCalls = 0;

  const defaultVm = createFakeVm({
    delete: async () => {
      deleteCalls += 1;
    },
    extendTimeout: async (duration: number) => {
      extendTimeoutCalls.push(duration);
    },
  });

  const client: SandboxClient = {
    getOrCreate: async (params) => {
      getOrCreateCalls.push(params);
      if (options.getOrCreate) return options.getOrCreate(params);
      return defaultVm;
    },
    get: async (params) => {
      getCalls.push(params);
      if (options.get) return options.get(params);
      return defaultVm;
    },
  };

  return {
    client,
    getOrCreateCalls,
    getCalls,
    extendTimeoutCalls,
    get deleteCalls() {
      return deleteCalls;
    },
  };
}

describe("isSandboxGoneError", () => {
  it("treats a stopped sandbox as gone", () => {
    assert.equal(
      isSandboxGoneError({ response: { status: 410 } }),
      true,
    );
    assert.equal(
      isSandboxGoneError(new Error("410 SANDBOX_STOPPED")),
      true,
    );
  });

  it("does not treat other failures as a stopped sandbox", () => {
    assert.equal(isSandboxGoneError(new Error("network timeout")), false);
  });
});

describe("ensureGameSandbox", () => {
  it("restarts a healthy bridge when its stored token is missing", async () => {
    const commands: Array<string | { cmd: string; env?: Record<string, string> }> = [];
    const vm = createFakeVm({
      runCommand: async (command, args) => {
        commands.push(typeof command === "string" ? (args ?? []).join(" ") : command);
        const shell = typeof command === "string" ? (args ?? []).join(" ") : "";
        return {
          exitCode: 0,
          stdout: async () => shell.includes("/__kayra/health") ? BRIDGE_HEALTH : "",
          stderr: async () => "",
        };
      },
    });
    const client = createFakeClient({ getOrCreate: async () => vm }).client;

    const result = await ensureGameSandbox("chat-abc", { client });
    const bridgeStart = commands.find(
      (command) => typeof command !== "string" && command.cmd === "node",
    );
    assert.ok(bridgeStart && typeof bridgeStart !== "string");
    assert.equal(bridgeStart.env?.KAYRA_TOKEN, result.token);
    assert.ok(commands.some((command) => typeof command === "string" && command.includes("pkill -f '[n]ode")));
  });

  it("restarts a healthy bridge when its token fails authentication", async () => {
    let started = false;
    const vm = createFakeVm({
      runCommand: async (command, args) => {
        if (typeof command !== "string" && command.cmd === "node") started = true;
        const shell = typeof command === "string" ? (args ?? []).join(" ") : "";
        return {
          exitCode: shell.includes("/__kayra/compile-error") && !started ? 22 : 0,
          stdout: async () => shell.includes("/__kayra/health") ? BRIDGE_HEALTH : "",
          stderr: async () => "",
        };
      },
    });
    const client = createFakeClient({ getOrCreate: async () => vm }).client;

    const result = await ensureGameSandbox("chat-abc", {
      client,
      existingToken: "expected-token",
    });
    assert.equal(result.token, "expected-token");
    assert.equal(started, true);
  });

  it("installs the 3D libraries when they are not in the template", async () => {
    const shells: string[] = [];
    const fake = createFakeClient({
      getOrCreate: async () =>
        createFakeVm({
          runCommand: async (command, args, opts) => {
            const shell = Array.isArray(args) ? args.join(" ") : "";
            if (typeof command === "string") shells.push(shell);
            if (shell.includes("npm install three")) {
              const timeout = opts?.timeoutMs ?? 0;
              assert.ok(timeout <= 200_000);
              assert.ok(timeout >= 120_000);
            }
            const missingLibs = shell.includes("node_modules/three");
            return {
              exitCode: missingLibs ? 1 : 0,
              stdout: async () => "",
              stderr: async () => "",
            };
          },
        }),
    });

    await ensureGameSandbox("chat-abc", { client: fake.client });

    const install = shells.join("\n");
    assert.match(install, /npm install three @react-three\/fiber @react-three\/drei @react-three\/rapier zustand @use-gesture\/react/);
    assert.match(install, /npx expo install expo-gl expo-av expo-haptics/);
    assert.match(install, /fuser -k 19006\/tcp/);
    assert.match(install, /pkill -f '\[e\]xpo'/);
  });

  it("writes a holding page over the Expo starter before Expo serves", async () => {
    const written: Array<{ path: string; content: string }> = [];
    const shells: string[] = [];
    const fake = createFakeClient({
      getOrCreate: async () =>
        createFakeVm({
          runCommand: async (command, args) => {
            const shell = Array.isArray(args) ? args.join(" ") : "";
            shells.push(shell);
            const missingLibs =
              typeof command === "string" && shell.includes("node_modules/three");
            return {
              exitCode: missingLibs ? 1 : 0,
              stdout: async () => "",
              stderr: async () => "",
            };
          },
          writeFiles: async (files) => {
            for (const file of files) {
              written.push({
                path: file.path,
                content:
                  typeof file.content === "string"
                    ? file.content
                    : new TextDecoder().decode(file.content),
              });
            }
          },
        }),
    });

    await ensureGameSandbox("chat-abc", { client: fake.client });

    const byPath = Object.fromEntries(written.map((f) => [f.path, f.content]));
    const index = byPath["/template/app/(tabs)/index.tsx"];
    const layout = byPath["/template/app/(tabs)/_layout.tsx"];
    assert.ok(index, "expected holding page at /template/app/(tabs)/index.tsx");
    assert.match(
      index,
      /Kayra is building your game\. When it's done, it will show here\./,
    );
    assert.match(index, /#F0E6FA/);
    assert.match(index, /#1A202C/);
    assert.doesNotMatch(index, /#f7f7f5|#ffffff/i);
    assert.match(layout, /import \{ Slot \} from 'expo-router'/);
    assert.doesNotMatch(layout, /Tabs|Explore|Home/);
    assert.ok(shells.some((shell) => shell.includes("rm -f '/template/app/(tabs)/explore.tsx'")));
    assert.match(byPath["/template/examples/tap-game.tsx"], /export default function TapGame/);
    assert.doesNotMatch(index, /Tap the Explore tab/);
  });

  it("restores a committed game onto a fresh machine before Expo starts", async () => {
    const order: string[] = [];
    const written: Array<{ path: string; content: string }> = [];
    const fake = createFakeClient({
      getOrCreate: async () =>
        createFakeVm({
          runCommand: async (command, args) => {
            const shell = Array.isArray(args) ? args.join(" ") : "";
            const described =
              typeof command === "string" ? shell : JSON.stringify(command);
            if (described.includes("npx expo start")) order.push("expo");
            const missingLibs = shell.includes("node_modules/three");
            const expoDown = shell.includes("19006");
            return {
              exitCode: missingLibs || expoDown ? 1 : 0,
              stdout: async () => "",
              stderr: async () => "",
            };
          },
          writeFiles: async (files) => {
            for (const file of files) {
              const content =
                typeof file.content === "string"
                  ? file.content
                  : new TextDecoder().decode(file.content);
              written.push({ path: file.path, content });
              order.push(`write:${file.path}`);
            }
          },
        }),
    });

    const screen = "export default function Game(){return null}";
    await ensureGameSandbox("chat-abc", {
      client: fake.client,
      game: {
        files: [{ path: "/template/app/(tabs)/index.tsx", content: screen }],
        diskEdits: [],
      },
    });

    const index = written.find((file) => file.path === "/template/app/(tabs)/index.tsx");
    assert.equal(index?.content, screen);
    assert.match(written.find((file) => file.path === "/template/app/(tabs)/_layout.tsx")?.content ?? "", /<Slot \/>/);
    assert.equal(
      written.some((file) => file.content.includes(HOLDING_SENTENCE)),
      false,
    );
    const wroteGame = order.indexOf("write:/template/app/(tabs)/index.tsx");
    const startedExpo = order.indexOf("expo");
    assert.ok(wroteGame >= 0);
    assert.ok(startedExpo > wroteGame);
  });

  it("keeps routes and layouts explicitly saved by a game", async () => {
    const written: Array<{ path: string; content: string }> = [];
    const shells: string[] = [];
    const fake = createFakeClient({
      getOrCreate: async () => createFakeVm({
        runCommand: async (command, args) => {
          const shell = typeof command === "string" ? (args ?? []).join(" ") : "";
          shells.push(shell);
          return { exitCode: shell.includes("node_modules/three") ? 1 : 0, stdout: async () => "", stderr: async () => "" };
        },
        writeFiles: async (files) => {
          for (const file of files) written.push({ path: file.path, content: String(file.content) });
        },
      }),
    });

    await ensureGameSandbox("chat-abc", {
      client: fake.client,
      game: {
        files: [
          { path: "/template/app/(tabs)/index.tsx", content: "game screen" },
          { path: "/template/app/(tabs)/_layout.tsx", content: "custom layout" },
          { path: "/template/app/(tabs)/explore.tsx", content: "custom route" },
        ],
        diskEdits: [],
      },
    });

    assert.equal(written.find((file) => file.path.endsWith("/_layout.tsx"))?.content, "custom layout");
    assert.equal(written.find((file) => file.path.endsWith("/explore.tsx"))?.content, "custom route");
    assert.equal(shells.some((shell) => shell.includes("rm -f '/template/app/(tabs)/explore.tsx'")), false);
  });

  it("replaces a placeholder already on disk and leaves a real game alone", async () => {
    const written: string[] = [];
    const game = {
      files: [{ path: "/template/app/(tabs)/index.tsx", content: "the game" }],
      diskEdits: [],
    };

    async function run(holdingOnDisk: boolean) {
      written.length = 0;
      const fake = createFakeClient({
        getOrCreate: async () =>
          createFakeVm({
            runCommand: async (command, args) => {
              const shell = Array.isArray(args) ? args.join(" ") : "";
              if (shell.includes("grep -F")) {
                return {
                  exitCode: holdingOnDisk ? 0 : 1,
                  stdout: async () => "",
                  stderr: async () => "",
                };
              }
              return { exitCode: 0, stdout: async () => "ok 5", stderr: async () => "" };
            },
            writeFiles: async (files) => {
              for (const file of files) written.push(file.path);
            },
          }),
      });
      await ensureGameSandbox("chat-abc", { client: fake.client, game });
    }

    await run(true);
    assert.ok(written.includes("/template/app/(tabs)/index.tsx"));

    await run(false);
    assert.equal(written.includes("/template/app/(tabs)/index.tsx"), false);
  });

  it("replaces an old bridge and starts Expo with enough memory", async () => {
    const calls: unknown[] = [];
    const fake = createFakeClient({
      getOrCreate: async () =>
        createFakeVm({
          runCommand: async (command, args) => {
            calls.push(typeof command === "string" ? (args ?? []).join(" ") : command);
            const shell = typeof command === "string" ? (args ?? []).join(" ") : "";
            if (shell.includes("19006")) {
              return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
            }
            const health = shell.includes("__kayra/health") ? "ok" : "";
            return { exitCode: 0, stdout: async () => health, stderr: async () => "" };
          },
        }),
    });

    await ensureGameSandbox("chat-abc", { client: fake.client });

    const text = JSON.stringify(calls);
    assert.match(text, /pkill -f '\[n\]ode \/opt\/kayra-bridge\.mjs'/);
    assert.match(text, /KAYRA_RESTART_EXPO/);
    assert.match(text, /max-old-space-size=1536/);
  });

  it("serializes Expo startup on the fixed preview port", () => {
    const shell = expoStartShell();
    assert.match(shell, /flock -n \/tmp\/kayra-expo\.lock/);
    assert.match(shell, /--port 19006/);
  });

  it("keeps the sandbox when the timeout cannot be extended further", async () => {
    const fake = createFakeClient({
      getOrCreate: async () =>
        createFakeVm({
          extendTimeout: async () => {
            throw new Error(
              "Status code 400 is not ok: Failed to extend timeout: extension would exceed maximum execution timeout",
            );
          },
        }),
    });

    const result = await ensureGameSandbox("chat-abc", { client: fake.client });
    assert.equal(result.previewUrl, "https://preview.example");
  });

  it("calls getOrCreate with persistent false, 1 vCPU, and a 10-minute timeout", async () => {
    const fake = createFakeClient();

    await ensureGameSandbox("chat-abc", { client: fake.client });

    assert.equal(fake.getOrCreateCalls.length, 1);
    const params = fake.getOrCreateCalls[0] as {
      name: string;
      ports: number[];
      timeout: number;
      persistent: boolean;
      resources: { vcpus: number };
    };

    assert.equal(params.persistent, false);
    assert.equal(params.resources.vcpus, 1);
    assert.equal(params.timeout, 10 * 60 * 1000);
    assert.equal(params.timeout, SESSION_TIMEOUT_MS);
    assert.notEqual(params.timeout, 45 * 60 * 1000);
    assert.deepEqual(params.ports, [3000]);
    assert.equal(params.name, "kayra-chat-abc");
    assert.deepEqual(fake.extendTimeoutCalls, [10 * 60 * 1000]);
  });
});

describe("deleteGameSandbox", () => {
  it("calls delete on the VM", async () => {
    const fake = createFakeClient();

    await deleteGameSandbox("chat-abc", { client: fake.client });

    assert.equal(fake.deleteCalls, 1);
    assert.equal(fake.getCalls.length, 1);
  });

  it("is a no-op when the sandbox is already missing", async () => {
    const fake = createFakeClient({
      get: async () => null,
    });

    await assert.doesNotReject(() =>
      deleteGameSandbox("chat-abc", { client: fake.client }),
    );
    assert.equal(fake.deleteCalls, 0);
    assert.equal(fake.getOrCreateCalls.length, 0);
  });
});

describe("downloadGameArchive", () => {
  it("does not create a sandbox when one is missing", async () => {
    const fake = createFakeClient({
      get: async () => null,
    });

    const result = await downloadGameArchive("chat-abc", { client: fake.client });

    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.equal(result.reason, "not_found");
    }
    assert.equal(fake.getOrCreateCalls.length, 0);
    assert.equal(fake.getCalls.length, 1);
  });
});
