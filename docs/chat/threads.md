# Chats and messages

`components/chat/ChatInterface.tsx` lists chats, selects one, and sends user text. `MessageComponent` renders thread messages. Persistence and AI scheduling live in `convex/chat.ts`.

## Saved as

- **Chat row:** `chats` — `createChat` inserts `repoId: "sandbox"` and does not schedule Freestyle repo creation.
- **Message row:** `messages` — user rows from `sendMessage`; assistant rows from `saveAgentResponse`.
- **Agent thread:** `chats.threadId` plus Convex agent component threads (not a Kayra table). Created on first `sendMessage` if missing.
- **AI turn flag:** `chats.isAiTurn` — set true when a message is sent, cleared when `processMessage` finishes.

## Shown from

| UI | Reads |
| --- | --- |
| `ChatInterface` chat picker | `listChats` |
| Selected chat / `isAiTurn` | `getChat` |
| Message list / streaming | `listThreadMessages` (needs `threadId`) |
| Preview pane | `getPreview` (separate surface; see [preview/sandbox.md](../preview/sandbox.md)) |

## Schema or shape

See [storage/schema.md](../storage/schema.md) for `chats` and `messages`. New chat insert:

```ts
{ userId, name: `3D Game ${Date.now()}`, createdAt: Date.now(), repoId: "sandbox" }
```

## Routes

All in `convex/chat.ts` unless noted:

| Function | Role |
| --- | --- |
| `listChats` | Owner’s chats, newest first |
| `createChat` | Insert chat with `repoId: "sandbox"` |
| `sendMessage` | Validate, insert user message, ensure thread, set `isAiTurn`, schedule `processMessage` |
| `getChat` | Owner chat or `null` |
| `deleteChat` | Delete messages, sandbox rows, schedule thread/repo cleanup, delete chat |
| `listThreadMessages` | Agent UI messages + stream deltas for a `threadId` |

Before `sendMessage`, `ChatInterface` calls `POST /api/sandbox` with `action: "ensure"` when a sandbox is required. Opening a chat does not call `ensure`.

## Design then code

For a new game, Kayra’s instructions (`createAgent` in `convex/agent.ts`) Phase 1 is a design reply (GDD). Code is written after the user approves.

## Deletes and leftovers

`deleteChat` removes Kayra `messages` and `sandboxes`, schedules agent thread delete when `threadId` exists, and calls Freestyle `deleteRepo` only when `isFreestyleRepoId(repoId)` matches a legacy UUID. `repoId: "sandbox"` does not call Freestyle.

## Drift

Root `README.md` Architecture still says Freestyle provisions a Git repo on chat create. Live `createChat` only sets `repoId: "sandbox"`.
