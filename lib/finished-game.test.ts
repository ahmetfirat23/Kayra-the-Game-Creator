import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTextEdits,
  finishedGameFromUiMessages,
  includesGameScreen,
  safeTemplatePath,
  successfulCommitCountFromUiMessages,
} from "./finished-game.ts";

const SCREEN = "/template/app/(tabs)/index.tsx";

function writePart(
  files: Array<{ path: string; content: string }>,
  state = "output-available",
) {
  return {
    type: "tool-writeFiles",
    state,
    input: { files },
    output: { _multiFileWrite: true, files: files.map((file) => ({ path: file.path, success: true })) },
  };
}

function commitPart(text = "Committed changes successfully.", state = "output-available") {
  return { type: "tool-commitAndPush", state, output: text };
}

describe("finishedGameFromUiMessages", () => {
  it("keeps the later commit when the newer message is listed first", () => {
    const game = finishedGameFromUiMessages([
      {
        order: 2,
        parts: [
          writePart([{ path: SCREEN, content: "second game" }]),
          commitPart(),
        ],
      },
      {
        order: 1,
        parts: [
          writePart([{ path: SCREEN, content: "first game" }]),
          commitPart(),
        ],
      },
    ]);
    assert.equal(game?.files[0]?.content, "second game");
  });

  it("keeps the files written before the last successful commit", () => {
    const game = finishedGameFromUiMessages([
      {
        parts: [
          writePart([{ path: SCREEN, content: "export default function Game(){return null}" }]),
          commitPart(),
          writePart([{ path: SCREEN, content: "not committed yet" }]),
        ],
      },
    ]);

    assert.ok(game);
    assert.equal(game.files.length, 1);
    assert.equal(game.files[0].content, "export default function Game(){return null}");
    assert.equal(includesGameScreen(game), true);
  });

  it("returns nothing when the game was never committed", () => {
    const game = finishedGameFromUiMessages([
      { parts: [writePart([{ path: SCREEN, content: "draft" }])] },
    ]);
    assert.equal(game, null);
  });

  it("replays a Git commit that an older bridge mislabeled after Expo timed out", () => {
    const game = finishedGameFromUiMessages([{ parts: [
      writePart([{ path: SCREEN, content: "saved game" }]),
      commitPart("Error committing: Expo did not become ready after the game was committed.\nWeb bundle 99.2%"),
    ] }]);
    assert.equal(game?.files[0]?.content, "saved game");
  });

  it("ignores a commit that failed", () => {
    const game = finishedGameFromUiMessages([
      {
        parts: [
          writePart([{ path: SCREEN, content: "draft" }]),
          commitPart("Error committing: git failed"),
        ],
      },
    ]);
    assert.equal(game, null);
  });

  it("applies an edit onto a file written in the same commit", () => {
    const game = finishedGameFromUiMessages([
      {
        parts: [
          writePart([{ path: SCREEN, content: "color = red" }]),
          {
            type: "tool-editFiles",
            state: "output-available",
            input: {
              files: [{ path: SCREEN, edits: [{ oldText: "red", newText: "blue" }] }],
            },
            output: "edited",
          },
          commitPart(),
        ],
      },
    ]);

    assert.equal(game?.files[0].content, "color = blue");
  });

  it("keeps an edit of a template file for the VM to apply", () => {
    const game = finishedGameFromUiMessages([
      {
        parts: [
          {
            type: "tool-editFiles",
            state: "output-available",
            input: {
              files: [
                {
                  path: "/template/app/(tabs)/_layout.tsx",
                  edits: [{ oldText: "Explore", newText: "Play" }],
                },
              ],
            },
            output: "edited",
          },
          commitPart(),
        ],
      },
    ]);

    assert.deepEqual(game?.diskEdits, [
      {
        path: "/template/app/(tabs)/_layout.tsx",
        edits: [{ oldText: "Explore", newText: "Play" }],
      },
    ]);
    assert.equal(includesGameScreen(game), false);
  });

  it("drops paths outside the template and failed writes", () => {
    const game = finishedGameFromUiMessages([
      {
        parts: [
          {
            type: "tool-writeFiles",
            state: "output-available",
            input: {
              files: [
                { path: "/etc/passwd", content: "nope" },
                { path: "/template/../secret", content: "nope" },
                { path: SCREEN, content: "kept" },
                { path: "/template/skip.tsx", content: "lost" },
              ],
            },
            output: {
              files: [
                { path: SCREEN, success: true },
                { path: "/template/skip.tsx", success: false },
              ],
            },
          },
          commitPart(),
        ],
      },
    ]);

    assert.deepEqual(game?.files.map((file) => file.path), [SCREEN]);
  });
});

describe("successfulCommitCountFromUiMessages", () => {
  it("counts a commit only after its successful output is available", () => {
    assert.equal(
      successfulCommitCountFromUiMessages([
        {
          parts: [
            commitPart("Committed changes successfully.", "input-available"),
            commitPart("Error committing: git failed"),
            commitPart(),
          ],
        },
      ]),
      1,
    );
  });

  it("recognizes the bridge tool name too", () => {
    assert.equal(
      successfulCommitCountFromUiMessages([
        {
          parts: [
            {
              type: "tool-git_commit_and_push",
              state: "output-available",
              output: "committed",
            },
          ],
        },
      ]),
      1,
    );
  });
});

describe("applyTextEdits", () => {
  it("replaces the first matching span and skips a missing one", () => {
    assert.equal(
      applyTextEdits("aaa", [
        { oldText: "a", newText: "b" },
        { oldText: "missing", newText: "x" },
      ]),
      "baa",
    );
  });
});

describe("safeTemplatePath", () => {
  it("accepts a template file and rejects escape paths", () => {
    assert.equal(safeTemplatePath("/template/app/(tabs)/index.tsx"), "/template/app/(tabs)/index.tsx");
    assert.equal(safeTemplatePath("/tmp/game.tsx"), null);
  });
});
