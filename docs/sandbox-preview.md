# Sandbox preview

Sending a message starts a Vercel Sandbox for that chat, runs the Expo template inside it, and shows the app in the preview pane. Closing or leaving the page deletes the sandbox. A reload cancels that delete if the page sends a heartbeat within a few seconds.

`LANGUAGE_MODEL` in `convex/config.ts` is `gpt-5.6-luna`.

## Saved as

`registerSandbox` in `convex/chat.ts` writes one `sandboxes` row per chat: `previewUrl`, `execUrl`, `token`, and `updatedAt`. `createChat` stores `repoId: "sandbox"` and does not create a Freestyle repository.

## Shown from

`getPreview` returns `{ previewUrl }` for the signed-in owner. It does not return `token` or `execUrl`. `ChatInterface` puts that URL in an iframe titled "Game preview".

`getSandboxAccess` returns the command token to the owner for `app/api/sandbox/route.ts`. The preview pane does not call it.

## Schema or shape

`sandboxes` in `convex/schema.ts`: `chatId`, `previewUrl`, `execUrl`, `token`, `updatedAt`, indexed by `by_chat`.

`ensureGameSandbox` in `lib/game-sandbox.ts` creates the VM with `persistent: false`, one vCPU, port 3000, and a 10-minute timeout, then calls `extendTimeout` for that same duration. If the platform refuses a further extension, the existing sandbox is kept. If `three`, `@react-three/fiber`, or `expo-gl` is missing from `node_modules`, it installs the Expo template, then `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `zustand`, `@use-gesture/react`, `expo-gl`, `expo-av`, and `expo-haptics`, and restarts Expo so the preview picks up the new packages. After that install and before Expo serves, it overwrites `/template/app/(tabs)/index.tsx` and `/template/app/(tabs)/_layout.tsx` with a quiet holding page (no Explore tab) that Kayra later replaces with the real game. The bridge in `lib/kayra-bridge.mjs` listens on port 3000, proxies other requests to Expo on port 19006, and strips `x-frame-options` and `content-security-policy`. While Expo is still starting, the bridge returns a page that reloads itself. `npm_install` with no package name does not run npm. `exec` refuses `reset-project`, lint, a second Expo or `npm run dev`, and a full `npm install` with no package name. The library install itself stops after 200 seconds so the preview route can still finish. `commitAndPush` saves a git commit and does not run a typecheck.

## Routes

`POST /api/sandbox` takes `{ chatId, action }`.

- `ensure` creates or reuses the sandbox and returns `{ previewUrl }`. If the last heartbeat is at least 60 seconds old, it deletes the old VM first.
- `heartbeat` refreshes `updatedAt` and extends the VM by one minute. If the VM is already gone, it clears the row.
- `leave` waits three seconds, then deletes the VM unless a heartbeat updated the row during the wait.
- `delete` deletes the VM immediately and clears the row.
- `download` returns a base64 tar of `/template` without `node_modules`, `.git`, or `.expo`. It does not create a sandbox.

The caller must be signed in. `ChatInterface` calls `ensure` before `sendMessage`, and `heartbeat` every 20 seconds while a chat is selected.

## Deletes and leftovers

`sandboxActionForPageEvent` in `lib/sandbox-page.ts` maps `pagehide`, `beforeunload`, and `sign-out` to `leave`. `visibility-hidden` does not. Switching chats stops the sandbox that was left. Opening a chat does not start one. The preview pane shows "Reload the game" when that chat has messages and no running sandbox. A stopped sandbox (`410 SANDBOX_STOPPED`) is cleared so the iframe is not left on the dead address. `clearSandbox` removes the Convex row and does not delete the chat. `deleteChat` also removes sandbox rows, and calls Freestyle `deleteRepo` only when `isFreestyleRepoId` matches a legacy UUID.

A crashed tab does not send `leave`. The sandbox then ends when its timeout runs out. `shouldDeleteSession` in `lib/sandbox-lifecycle.ts` treats a heartbeat older than 60 seconds as stale on the next `ensure`.
