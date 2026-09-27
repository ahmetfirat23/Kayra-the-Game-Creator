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

`isPreparing` in `ChatInterface` is React state only. It covers the “Starting your game environment…” spinner around `POST /api/sandbox` `ensure` (send and “Reload the game”). It is not persisted.

## Preview URL — Convex row, not client storage

`ChatInterface` reads `api.chat.getPreview`, which returns `{ previewUrl }` from the `sandboxes` table via `previewForClient`. The iframe `src` is that URL. Do not treat the preview address as `localStorage`.

## Game files — not client state

Game source lives on the sandbox VM disk under `/template` (`persistent: false`). It is not stored in React state or Convex document fields.
