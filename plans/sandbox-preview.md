# Sandbox preview

Kayra starts a Vercel Sandbox when a signed-in user sends a game message, shows the Expo app in the preview pane, and deletes that sandbox as soon as the user leaves. Freestyle dev servers are not used for new sessions.

The repository default branch is `main`. This task is on `kayra-sandbox-preview`.

## Limits

Hobby account, shared by the existing Vercel projects:

- 5 hours of Active CPU per month
- 420 GB-hours of provisioned memory per month
- 45 minutes maximum session
- 15 GB lifetime snapshot storage

A running sandbox spends the memory allowance the whole time it is up. An idle Expo process can still use CPU. `stop()` on a persistent sandbox keeps a snapshot. This task uses `persistent: false`, one vCPU (2 GB), and `sandbox.delete()` so a finished session does not keep a snapshot.

## Surface

- `POST /api/sandbox` with `{ chatId, action: "ensure" | "delete" | "download" }`
- The signed-in user must own the chat. Anyone else gets 401 or 403.
- `ensure` creates or reuses the live sandbox named `kayra-<chatId>` and returns `{ previewUrl }` only.
- `delete` calls `sandbox.delete()` and removes the Convex sandbox row. A missing sandbox is success.
- `download` returns a base64 tar of `/template` without `node_modules`, `.git`, or `.expo`. It does not create a sandbox that was already deleted.
- While the preview page is open it sends a heartbeat at least every 20 seconds.
- `pagehide` and sign-out send `delete` immediately.
- If no heartbeat arrives for 60 seconds, the next `ensure` or a scheduled check deletes the sandbox.
- The preview query returns `previewUrl` and never `token` or `execUrl`.

## Model

`convex/config.ts` `LANGUAGE_MODEL` is `gpt-5.6-luna`.

That is the current cost-sensitive GPT model: $0.20 per 1M input tokens and $1.20 per 1M output tokens. `gpt-5-mini` is $0.25 / $2.00. Do not switch to `gpt-5.4-mini` ($0.75 / $4.50) or `gpt-5.6-terra` ($2 / $12).

## Chunks

1. Lifecycle rules in `lib/sandbox-lifecycle.ts`, with `node:test` covering delete-on-leave, the 60-second leftover cutoff, a heartbeat that keeps the session, and a preview payload that refuses to include the command token.
2. Sandbox driver in `lib/game-sandbox.ts` and `lib/kayra-bridge.mjs`. Fake the Vercel client in tests. Assert `delete` removes the VM, a second `delete` is a no-op, and `ensure` does not set `persistent: true`.
3. Convex `sandboxes` table, `registerSandbox`, `getPreview`, `getSandboxSession`. `processMessage` uses the bridge client. `createChat` stores `repoId: "sandbox"` and does not call Freestyle. Tests cover a missing session (the send is refused with a retryable error) and `getPreview` dropping the token.
4. Route, chat send, iframe, heartbeat, and `pagehide` delete. Browser check: the preview request is same-origin, and leaving the page issues `delete`.
5. `docs/sandbox-preview.md` in the code-map voice, after the code is on the branch.
6. Set `LANGUAGE_MODEL` to `gpt-5.6-luna`. A test asserts that value and rejects `gpt-5-mini`, `gpt-5.4-mini`, and `gpt-5.6-terra`.

## Checks

- `node --test`
- `npx tsc --noEmit`

Do not push. Do not change git config. Commit each accepted chunk on this branch.
