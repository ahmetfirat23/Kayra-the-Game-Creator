# Sandbox preview

`POST /api/sandbox` in `app/api/sandbox/route.ts` creates, heartbeats, leaves, deletes, or downloads a Vercel Sandbox for a chat. `ensureGameSandbox` in `lib/game-sandbox.ts` owns the VM. `ChatInterface` drives ensure / heartbeat / leave / delete and puts `getPreview`’s URL in the iframe.

## Saved as

### Convex `sandboxes` row

`registerSandbox` writes one row per chat: `previewUrl`, `execUrl`, `token`, `updatedAt`. `getPreview` returns `{ previewUrl, live }`. `getSandboxAccess` returns the full session to the signed-in owner for the Next.js route (not for the iframe).

### VM disk

Game files live under `/template` inside the sandbox. Created with `persistent: false`, `VCPUS = 1`, `SESSION_TIMEOUT_MS = 10 * 60 * 1000`. Gone when the VM is deleted. Not a Convex document. The last successful commit stays in the agent thread and is written back before Expo starts.

## Shown from

`ChatInterface` queries `api.chat.getPreview`. `previewForClient` returns `{ previewUrl, live }`. `live` is true while `updatedAt` is inside the last 60 seconds. `shouldShowLivePreview` mounts that URL on every screen looking at the chat, including a phone that did not start the machine. A stale URL shows “This preview is stopped.” and “Reload the game”. While `isPreparing` is true, the pane shows the starting screen instead of the iframe.

Reload calls `ensure`. `ensureGameSandbox` replays the last successful commit from the thread (`finishedGameFromUiMessages`) onto the VM before Expo starts. A fresh template, or a disk still showing the holding sentence, is replaced by those files. A machine that already has the game is left as it is.

## Schema or shape

```ts
// sandboxes table (convex/schema.ts)
{ chatId, previewUrl, execUrl, token, updatedAt } // index by_chat

// getPreview client payload (previewForClient)
{ previewUrl: string, live: boolean }
```

## Routes

`POST /api/sandbox` — body `{ chatId, action }`. `maxDuration = 300`. Caller must be signed in. File: `app/api/sandbox/route.ts`.

| Action | Writes / returns |
| --- | --- |
| `ensure` (default) | May delete a stale VM (heartbeat ≥ 60s old, unless `isAiTurn`), then `ensureGameSandbox`, `registerSandbox`, returns `{ previewUrl }`. Template install cap 200s |
| `heartbeat` | `touchSandbox`; extend timeout 60s. If VM gone (`410` / `SANDBOX_STOPPED`), `clearSandbox` so the iframe is not left on a dead address |
| `leave` | Wait 3s; if heartbeat refreshed `updatedAt`, cancel; else delete VM + `clearSandbox` |
| `delete` | Delete VM + `clearSandbox` immediately |
| `download` | Base64 tar of `/template` (excludes `node_modules`, `.git`, `.expo`, `.cache`); does not create a sandbox |

### Client lifecycle (`ChatInterface` + helpers)

- Heartbeat every **20 seconds** while a chat is selected (`postSandbox(..., "heartbeat")`).
- Stale heartbeat threshold: **60 seconds** (`shouldDeleteSession` / `shouldRecreateStaleSandbox` in `lib/sandbox-lifecycle.ts`). Mid-AI-turn ensure does not recreate on stale heartbeat alone.
- `sandboxToStopOnSwitch`: switching chats `delete`s the previous sandbox. Opening a chat does **not** call `ensure`.
- Reload calls `ensure` only when `shouldEnsureSandboxOnReload(isAiTurn)` is true (`isAiTurn` false).
- `pagehide`, `beforeunload`, and `sign-out` map to `leave` via `sandboxActionForPageEvent` in `lib/sandbox-page.ts`. `visibility-hidden` does not. `ChatInterface` wires `pagehide` and `beforeunload`.
- Sending a message calls `ensure` before `sendMessage`.
- `extendSandboxTimeout`: errors matching platform “maximum execution timeout” are swallowed; other errors are not.

## Deletes and leftovers

`clearSandbox` removes Convex rows only. `deleteChat` also clears sandbox rows and may Freestyle-delete a legacy UUID `repoId`. A crashed tab that never sends `leave` ends when the VM timeout expires; the next `ensure` treats a 60s-stale heartbeat as recreate-worthy when not mid-turn.

## Drift

Root `README.md` Architecture still describes Freestyle Sandboxes and live Git repos as the preview. Live preview is a Vercel Sandbox with `repoId: "sandbox"`.
