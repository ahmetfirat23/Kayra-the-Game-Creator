import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expoRestartScript } from "./kayra-bridge.mjs";
import { finishedGameFromUiMessages } from "./finished-game.ts";
import {
  HOLDING_SENTENCE,
  ensureGameSandbox,
  type SandboxVm,
} from "./game-sandbox.ts";
import {
  nextPreviewEpoch,
  previewForClient,
  previewFrameSrc,
  previewPane,
} from "./sandbox-lifecycle.ts";

const SCREEN = "/template/app/(tabs)/index.tsx";
const FIRST = "export default function Game(){return 'red cube'}";
const NEXT = "export default function Game(){return 'blue cube'}";

function write(content: string) {
  return {
    type: "tool-writeFiles",
    state: "output-available",
    input: { files: [{ path: SCREEN, content }] },
    output: { files: [{ path: SCREEN, success: true }] },
  };
}

function commit() {
  return {
    type: "tool-commitAndPush",
    state: "output-available",
    output: "Committed changes successfully.",
  };
}

describe("reload of a finished game", () => {
  it("puts the latest commit on a fresh machine before Expo, not the placeholder", async () => {
    const listedNewestFirst = [
      { order: 2, parts: [write(NEXT), commit()] },
      { order: 1, parts: [write(FIRST), commit()] },
    ];
    const game = finishedGameFromUiMessages(listedNewestFirst);
    assert.equal(game?.files[0]?.content, NEXT);

    const order: string[] = [];
    const written: string[] = [];
    const vm: SandboxVm = {
      delete: async () => {},
      extendTimeout: async () => {},
      domain: () => "https://preview.example",
      writeFiles: async (files) => {
        for (const file of files) {
          const content = typeof file.content === "string" ? file.content : "";
          written.push(content);
          order.push(file.path);
        }
      },
      runCommand: async (command, args) => {
        const shell = Array.isArray(args) ? args.join(" ") : "";
        const described = typeof command === "string" ? shell : JSON.stringify(command);
        if (described.includes("npx expo start")) order.push(described);
        const missingLibs = shell.includes("node_modules/three");
        const expoDown = shell.includes("19006");
        return {
          exitCode: missingLibs || expoDown ? 1 : 0,
          stdout: async () => "",
          stderr: async () => "",
        };
      },
    };

    await ensureGameSandbox("chat-1", {
      client: {
        getOrCreate: async () => vm,
        get: async () => vm,
      },
      game,
    });

    assert.equal(written.includes(NEXT), true);
    assert.equal(written.includes(FIRST), false);
    assert.equal(written.some((content) => content.includes(HOLDING_SENTENCE)), false);
    const wrote = order.indexOf(SCREEN);
    const started = order.findIndex((entry) => entry.includes("npx expo start"));
    assert.ok(wrote >= 0 && started > wrote);
    assert.match(order[started], /--clear/);
  });
});

describe("phone looking at the PC preview", () => {
  const now = 1_000_000;
  const shared = previewForClient(
    { previewUrl: "https://preview.example", updatedAt: now - 10_000, token: "secret" },
    now,
  );

  it("shows the running game instead of the stopped message", () => {
    assert.equal(shared.live, true);
    assert.equal("token" in shared, false);
    assert.equal(
      previewPane({
        hasChat: true,
        hasMessages: true,
        hasPreviewUrl: true,
        live: shared.live,
        preparing: false,
        previewKnown: true,
      }),
      "game",
    );
  });

  it("says stopped only when that same machine has gone quiet", () => {
    const stale = previewForClient(
      { previewUrl: "https://preview.example", updatedAt: now - 60_000 },
      now,
    );
    assert.equal(stale.live, false);
    assert.equal(
      previewPane({
        hasChat: true,
        hasMessages: true,
        hasPreviewUrl: true,
        live: stale.live,
        preparing: false,
        previewKnown: true,
      }),
      "stopped",
    );
  });
});

it("keeps a live preview visible while ensure is still pending", () => {
  assert.equal(previewPane({
    hasChat: true,
    hasMessages: true,
    hasPreviewUrl: true,
    live: true,
    preparing: true,
    previewKnown: true,
  }), "game");
});

describe("commit shows the new version", () => {
  it("changes the iframe address when the reply finishes", () => {
    const epoch = nextPreviewEpoch(true, false, 2);
    assert.equal(epoch, 3);
    const before = previewFrameSrc("https://preview.example", 2);
    const after = previewFrameSrc("https://preview.example", epoch);
    assert.notEqual(before, after);
    assert.match(after, /v=3/);
  });

  it("drops Metro's copy of the previous bundle before Expo starts again", () => {
    const script = expoRestartScript();
    assert.match(script, /--clear/);
    assert.match(script, /rm -rf \/template\/\.expo/);
    assert.match(script, /node_modules\/\.cache/);
    assert.match(script, /fuser -k 19006\/tcp/);
    assert.match(script, /pkill -f '\[m\]etro'/);
  });
});
