# Client state

Browser and React state that is not a Convex table row (except where noted). Theme and selected-chat restore live in `localStorage`. Preparing UI and the composer lock live in `ChatInterface`. The preview URL is a Convex `sandboxes` field, not `localStorage`.

## Theme — `localStorage`

`hooks/useTheme.ts` reads and writes the key `theme`.

```ts
type Theme = 'light' | 'dark' | 'system';
// localStorage.getItem('theme') / setItem('theme', ...) / removeItem('theme') for system
```

`ThemeToggle` in `ChatInterface` calls `toggleTheme`. Values cycle light → dark → system. System mode removes the key.

## Selected chat — React state + restore key

`components/chat/ChatInterface.tsx` keeps `selectedChatId` in React state. On change it also writes `localStorage` key `selectedChatId` so a reload can restore the last open chat. Opening a chat does not start a sandbox.

## Preparing / reload spinner — React state

`isPreparing` in `ChatInterface` is React state only. It covers the “Starting your game” screen around `POST /api/sandbox` `ensure` (send and “Reload the game”). It is not persisted.

## Preview URL — Convex row, not client storage

`ChatInterface` reads `api.chat.getPreview`, which returns `{ previewUrl, live }` from the `sandboxes` table via `previewForClient`. `live` follows `updatedAt`. Any screen with that chat open, including a phone, uses the URL while `live` is true. Do not treat the preview address as `localStorage`.

## Game files — thread, then VM disk

Kayra’s writes and edits live in the agent thread. `finishedGameFromUiMessages` keeps the files from the last successful commit. Reload writes those onto `/template` before Expo starts. The running copy is the sandbox disk (`persistent: false`). It is not a Convex document field and not React state.
