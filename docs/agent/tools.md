# Agent tools

`createAgent` and `createFreestyleTools` in `convex/agent.ts` build Kayra. `processMessage` in `convex/chat.ts` opens a sandbox tool client, passes those tools into `agent.streamText`, and saves the reply. Language model is `CONFIG.LANGUAGE_MODEL` in `convex/config.ts` (not a hard-coded name in this map).

## Saved as

Tool calls change files on the sandbox VM under `/template`. They do not write Convex rows except indirectly when the turn finishes (`saveAgentResponse`, token usage). Git commit state is on the VM disk.

## Shown from

`MessageComponent` in the chat pane renders tool parts from `listThreadMessages` (streaming UI messages). The preview iframe shows the game after files change and Expo rebuilds.

## Tools registered by `createFreestyleTools`

| Tool | After bridge guards |
| --- | --- |
| `listDirectory` | Up to 100 direct children of one directory |
| `readFiles` | Up to four paths or numbered ranges; bridge returns at most 160 lines per file |
| `searchCode` | Literal code search with path and line snippets |
| `writeFiles` | Create/overwrite full files; tracker can warn/stop on repeat writes |
| `editFiles` | Line/text replacements via bridge `edit_file` |
| `commitAndPush` | Bridge `git_commit_and_push`: Git commit, then Expo restart. A slow web bundle is reported as still starting; Git failure is reported separately. No typecheck |
| `searchFiles` | Find files under a path matching a pattern |
| `createDirectory` | `mkdir -p` style create |
| `npmInstall` | Bridge `npm_install`. Empty package list does **not** run npm |
| `npmRunLint` | Returns immediately: lint is not run |
| `exec` | Shell via bridge `exec`; refused commands never run (see below) |

## Bridge refusals (`lib/kayra-bridge.mjs` `refusedShell`)

`exec` (and bare installs) refuse:

- `reset-project`
- lint (`expo lint` / `npm run lint`)
- a second Expo start or `npm run` `dev` / `start` / `web` / `android` / `ios`
- a bare `npm install` / `pnpm install` / `npm ci` / `yarn install` with no package name

## Import rule (prompt)

Import `Canvas` / `useFrame` / `useThree` from `@react-three/fiber`, not `@react-three/fiber/native`.

## Deletes and leftovers

Stopping or deleting the sandbox removes the VM disk (`persistent: false`). Convex chat/message rows remain until `deleteChat`.

## Drift

Root `README.md` says the agent uses GPT-5-mini and that `commitAndPush` triggers build verification. The model is whatever `LANGUAGE_MODEL` is set to; `commitAndPush` only commits.
