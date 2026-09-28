# Preview bridge

`lib/kayra-bridge.mjs` runs inside the sandbox on port **3000**. It authenticates tool POSTs, proxies the browser preview to Expo on port **19006**, and strips framing headers so the app can load in Kayra’s iframe. Its preview health check tests whether Expo is listening on that port. A commit additionally waits for Expo's document and complete web bundle before reporting the preview ready.

## Saved as

Bridge source is written to `/opt/kayra-bridge.mjs` by `ensureProcesses` in `lib/game-sandbox.ts`. On a fresh install, committed game files from the thread are written before Expo starts. The holding page is written only when that install has no committed game screen (`writeHoldingPage`), still before Expo is started:

- `/template/app/(tabs)/index.tsx` — “Kayra is building your game. When it's done, it will show here.”
- `/template/app/(tabs)/_layout.tsx` — tabs layout with Explore hidden (`href: null`), no tab bar

Kayra later overwrites `index.tsx` with the real game.

## Shown from

The preview iframe loads `previewUrl` (sandbox domain for port 3000). Non-tool requests go through `proxyToExpo`. While Expo is down, the bridge serves `previewWaitingPage()` — the Kayra lavender-to-blue screen with the tree and “Starting your game...”, auto-refresh. A write inside `app/(tabs)/` also touches `app/_layout.tsx`, because Metro does not notice that path. `git_commit_and_push` kills whatever is listening on port 19006, deletes Metro's cache, starts Expo with `--clear`, and does not return until that port answers. The preview iframe address gains `v=<epoch>` when the reply finishes, and the bridge sends `cache-control: no-store`, so the previous bundle is not shown. The chat pane remounts the iframe when `isAiTurn` goes false (`nextPreviewEpoch`). While Expo is down, the bridge serves the Kayra screen (tree, `#F0E6FA` to `#E8F4FC`) and refreshes. The waiting page pins the tree, Kayra, and “Starting your game” with `position: fixed; inset: 0` so the line stays in the middle of the iframe. Health `ok 8` replaces an older bridge. A Metro compile error is not shown in the preview. The bridge keeps it for Kayra, and the chat sends it back to the agent without displaying the compiler text. A commit stops Expo before the tool returns, so the open frame cannot keep the placeholder. A Vercel deploy does not rewrite a machine that is already running.

## Schema or shape

Tool endpoint: `POST /__kayra/tool` with `Authorization: Bearer <token>`. Health: `GET /__kayra/health` → `ok`.

Proxy strips response headers `x-frame-options` and `content-security-policy` (any casing).

## Routes / tools on the bridge

`handleTool` implements `list_directory`, `read_file`, `search_code`, `write_file`, `edit_file`, `create_directory`, `search_files`, `npm_install`, `npm_run_lint`, `git_commit_and_push`, `exec`. Reads and searches return bounded excerpts.

`refusedShell` blocks:

- `reset-project`
- lint
- a second Expo or `npm run dev` / start / web / android / ios
- a bare `npm install` (no package name)

`npm_install` with an empty package list returns without running npm. `npm_run_lint` returns without running lint. `git_commit_and_push` commits only (no typecheck).

## Deletes and leftovers

When the sandbox VM is deleted, bridge, Expo, holding page, and `/template` go with it. Convex `sandboxes` must be cleared separately (`clearSandbox` / `deleteChat`).
