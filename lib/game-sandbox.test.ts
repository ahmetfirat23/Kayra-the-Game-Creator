import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_TIMEOUT_MS,
  deleteGameSandbox,
  downloadGameArchive,
  ensureGameSandbox,
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

describe("ensureGameSandbox", () => {
  it("installs the 3D libraries when they are not in the template", async () => {
    const shells: string[] = [];
    const fake = createFakeClient({
      getOrCreate: async () =>
        createFakeVm({
          runCommand: async (command, args, opts) => {
            const shell = Array.isArray(args) ? args.join(" ") : "";
            if (typeof command === "string") shells.push(shell);
            if (shell.includes("npm install three")) {
              assert.ok((opts?.timeoutMs ?? 0) >= 270_000);
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
