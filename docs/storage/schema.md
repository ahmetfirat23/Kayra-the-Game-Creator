# Convex schema

`convex/schema.ts` defines Kayra’s tables. There is no SQL foreign-key cascade: when a chat goes away, leftovers are whatever `deleteChat` and `clearSandbox` in `convex/chat.ts` delete explicitly.

## `users`

Auth, tier, encrypted BYOK key, and usage counters. Indexed by `by_clerk_id` on `clerkId`.

| Field | Required | Notes |
| --- | --- | --- |
| `clerkId` | yes | Clerk subject |
| `email` | yes | From Clerk |
| `name` | optional | From Clerk |
| `openaiApiKey` | optional | Encrypted BYOK |
| `isAdmin` | optional | Admin flag |
| `dailyMessageCount` | optional | Free daily counter |
| `totalTokensUsed` | optional | Aggregate tokens |
| `tier` | optional | `"free"` \| `"byok"` \| `"pro"` \| `"admin"` |
| `proSubscriptionStatus` | optional | `"active"` \| `"canceled"` |
| `proCurrentPeriodEnd` | optional | Period end ms |
| `proTokensUsedThisPeriod` | optional | Pro token counter |
| `proByokFallbackNotifiedThisPeriod` | optional | Fallback notice flag |
| `lastApiKeyUpdate` | optional | Rate-limit window |
| `apiKeyUpdateAttempts` | optional | Updates in window |

## `chats`

One chat per game session. Indexed by `by_user` on `userId`.

| Field | Required | Notes |
| --- | --- | --- |
| `userId` | yes | `Id<"users">` |
| `name` | yes | Display name |
| `createdAt` | yes | ms timestamp |
| `threadId` | optional | Convex agent component thread id |
| `repoId` | optional | `"sandbox"` for live chats; legacy Freestyle UUID otherwise |
| `isAiTurn` | optional | True while Kayra is responding |

## `messages`

Kayra’s own conversation rows (also mirrored into the agent thread). Indexed by `by_chat` on `chatId`.

| Field | Required | Notes |
| --- | --- | --- |
| `chatId` | yes | `Id<"chats">` |
| `text` | yes | Body |
| `sender` | yes | `"user"` \| `"assistant"` |
| `totalTokens` | optional | Assistant usage |

## `sandboxes`

One command/preview address row per chat. Indexed by `by_chat` on `chatId`.

| Field | Required | Notes |
| --- | --- | --- |
| `chatId` | yes | `Id<"chats">` |
| `previewUrl` | yes | iframe URL (bridge) |
| `execUrl` | yes | Tool endpoint URL |
| `token` | yes | Bearer for tool calls |
| `updatedAt` | yes | Last heartbeat / register ms |

## `usage`

Global free-tier token tracking. Indexed by `by_key` on `key`.

| Field | Required | Notes |
| --- | --- | --- |
| `key` | yes | `"global"` in practice |
| `freeTokensUsedToday` | optional | Sum across free users |
| `freeCapReachedToday` | optional | Cap flag |
| `lastFreeUsageReset` | optional | Last reset ms |

## Deletes and leftovers

- `deleteChat` deletes `messages` and `sandboxes` for that chat, schedules agent `deleteThread` when `threadId` is set, schedules Freestyle `deleteRepo` only when `isFreestyleRepoId(repoId)` matches, then deletes the `chats` row.
- `clearSandbox` deletes `sandboxes` rows for a chat and leaves the chat intact.
- Convex does not cascade these deletes; callers must run the mutations above.
