# Sandbox preview

`POST /api/sandbox` in `app/api/sandbox/route.ts` creates, heartbeats, deletes, or downloads a Vercel Sandbox for a chat. `ensureGameSandbox` in `lib/game-sandbox.ts` owns the VM. `ChatInterface` drives ensure / heartbeat / explicit delete and puts `getPreview`’s URL in the iframe.

## Saved as

### Convex `sandboxes` row

`registerSandbox` writes one row per chat: `previewUrl`, `execUrl`, `token`, `updatedAt`, the app origin, and per-tab viewer leases. `getPreview` returns `{ previewUrl, live }`. `getSandboxAccess` returns the full session to the signed-in owner for the Next.js route (not for the iframe).

### VM disk

Game files live under `/template` inside the sandbox. Created with `persistent: false`, `VCPUS = 1`, `SESSION_TIMEOUT_MS = 10 * 60 * 1000`. Gone when the VM is deleted. Not a Convex document. The last successful commit stays in the agent thread and is written back before Expo starts.

## Shown from

`ChatInterface` queries `api.chat.getPreview`. `previewForClient` returns `{ previewUrl, live }`. `live` is true while `updatedAt` is inside the last 60 seconds. `shouldShowLivePreview` mounts that URL on every screen looking at the chat, including a phone that did not start the machine. A stale URL shows “This preview is stopped.” and “Reload the game”. The app shows its starting screen only until a live URL exists; an already running VM stays visible while an ensure request finishes.

Reload calls `ensure`. `ensureGameSandbox` replays the last successful commit from the thread (`finishedGameFromUiMessages`) onto the VM before Expo starts. A fresh template, or a disk still showing the holding sentence, is replaced by those files. A machine that already has the game is left as it is.

## Schema or shape

```ts
// sandboxes table (convex/schema.ts)
{ chatId, previewUrl, execUrl, token, updatedAt, appOrigin?, viewers? } // index by_chat

// getPreview client payload (previewForClient)
{ previewUrl: string, live: boolean }
```

## Routes

`POST /api/sandbox` — body `{ chatId, action }`. `maxDuration = 300`. Caller must be signed in. File: `app/api/sandbox/route.ts`.

| Action | Writes / returns |
| --- | --- |
| `ensure` (default) | Reuses or creates the named VM with `ensureGameSandbox`, then `registerSandbox`; returns `{ previewUrl }`. Template install cap 200s |
| `heartbeat` | `touchSandbox` before VM/network checks; extend timeout 60s. Older tabs without a viewer ID use a shared per-account lease. If VM gone (`410` / `SANDBOX_STOPPED`), `clearSandbox` so the iframe is not left on a dead address |
| `release` | Remove this tab's viewer lease. If it was the last viewer, schedule cleanup after 10s |
| `delete` | Delete VM + `clearSandbox` immediately |
| `download` | Base64 tar of `/template` (excludes `node_modules`, `.git`, `.expo`, `.cache`); does not create a sandbox |

### Client lifecycle (`ChatInterface` + helpers)

- Each selected chat tab has a unique viewer ID. It heartbeats every **20 seconds** and releases its lease on chat switch or pagehide. A bfcache restore joins with a new ID.
- A lease expires after **60 seconds** without a heartbeat. Convex schedules cleanup checks; the last explicit release stops the VM after about **10 seconds**, while an abandoned tab stops it about **65 seconds** after its last heartbeat. A running AI turn postpones cleanup.
- The scheduled Convex action calls the app's `/api/sandbox/cleanup` endpoint, which validates the private session token and idle state before using Vercel Sandbox credentials to stop the VM.
- Stale heartbeat threshold: **60 seconds** for the client preview status. `ensure` reuses a running VM even if the last heartbeat is old.
- Switching chats stops that tab's heartbeat for the previous chat, but does not delete its VM. Another tab may still be using it. Opening a chat does **not** call `ensure`.
- Reload calls `ensure` only when `shouldEnsureSandboxOnReload(isAiTurn)` is true (`isAiTurn` false).
- Closing or reloading a tab releases only that tab's lease. Other tabs keep the VM running; deleting a game project still deletes its VM immediately.
- Sending a message calls `ensure` before `sendMessage`.
- `extendSandboxTimeout`: errors matching platform “maximum execution timeout” are swallowed; other errors are not.

## Deletes and leftovers

`clearSandbox` removes Convex rows only. `deleteChat` also clears sandbox rows and may Freestyle-delete a legacy UUID `repoId`. A chat with no remaining tabs is cleaned up by its scheduled lease check. The VM timeout remains a fallback if cleanup fails.

## Drift

Root `README.md` Architecture still describes Freestyle Sandboxes and live Git repos as the preview. Live preview is a Vercel Sandbox with `repoId: "sandbox"`.
