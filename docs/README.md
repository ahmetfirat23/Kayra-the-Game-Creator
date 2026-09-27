# Kayra code map

Per-surface map of what Kayra does, where it is saved, and which module shows it. Product and runbook stay in the root [`README.md`](../README.md). This tree names the file, the table, and the client store.

## Vocabulary

| Term | Meaning |
| --- | --- |
| **Kayra** | The product and the game-building agent |
| **chat** | One conversation / game session (`chats` row) |
| **message** | A turn in that chat (`messages` row, plus agent thread messages) |
| **game** | The Expo app files Kayra writes under `/template` in the sandbox |
| **sandbox** | The Vercel Sandbox VM that holds the game |
| **preview** | The iframe that loads the sandbox bridge URL |

One signed-in user per browser session.

## Surfaces

| Surface | Doc |
| --- | --- |
| Convex tables | [storage/schema.md](storage/schema.md) |
| Browser / React state | [storage/client-state.md](storage/client-state.md) |
| Chats and messages | [chat/threads.md](chat/threads.md) |
| Agent tools | [agent/tools.md](agent/tools.md) |
| Sandbox lifecycle | [preview/sandbox.md](preview/sandbox.md) |
| Preview bridge | [preview/bridge.md](preview/bridge.md) |
| Tiers and API keys | [account/tiers.md](account/tiers.md) |

## Pipeline

Chat message → `POST /api/sandbox` `ensure` → Kayra writes the game on the sandbox disk → preview iframe reads `getPreview` (`previewUrl` only).
