# Kayra - AI-Powered 3D Game Creator

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Convex](https://img.shields.io/badge/Convex-Backend-FF6A00?style=for-the-badge)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5--mini-412991?style=for-the-badge&logo=openai&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)

A web application that creates 3D hypercasual games through conversation. Users describe game ideas in natural language and watch them build in real-time with live preview.

## Architecture

**Frontend:** Next.js 16 with App Router, React 19, Tailwind CSS 4, Clerk authentication

**Backend:** Convex for serverless functions, real-time sync, and database

**AI:** Custom agent using Convex Agent framework + GPT-5-mini

**Dev Environment:** Freestyle Sandboxes provides isolated Git repositories and dev servers for each project

## Core Features

### Conversational Game Development

Users describe game ideas in chat. Kayra generates a Game Design Document outlining concept, mechanics, and visual style. After approval, it writes complete game files. The AI specializes in hypercasual games built with geometric primitives (spheres, boxes, cylinders) and understands:
- Mobile touch controls and gesture handling
- Performance optimization for web and mobile
- Color theory and environmental effects
- "Easy to learn, difficult to master" design principles

### Live Preview

Games build in isolated Git repositories. As the AI commits code, the dev server auto-rebuilds and updates the preview panel in real-time. Users see their Expo app running in the browser with full 3D rendering, physics, and interactions.

### Access Tiers

**Free:** 5 messages/day, resets at midnight UTC

**BYOK:** Unlimited usage with your own OpenAI API key

**Pro:** 7M tokens/month, auto-renews, falls back to BYOK when depleted

### Project Management

Each game is a separate chat with its own Git repo and dev server. Create multiple projects, switch between them, download complete source as zip, or delete when finished.

## Technical Implementation

### Agent System

The AI agent (`convex/agent.ts`) operates in two phases:

**Design Phase:** Generates GDD, waits for approval, allows revisions

**Implementation Phase:** Plans work in advance, reads only essential files, uses batch operations for multiple file writes/edits, commits after each meaningful change, auto-fixes TypeScript/Babel/Metro errors before returning to user

**Tools** (wrapped around Freestyle's MCP client):
- `writeFiles` - Create/overwrite complete files
- `editFiles` - Precise line-based changes
- `readFiles` - Fetch file contents (tracked to prevent redundant reads)
- `commitAndPush` - Save to Git + trigger build verification
- `listDirectory` - Explore project structure
- `npmInstall`, `exec` - Package management and shell commands

**Monitoring:** Tracks usage patterns to detect repetitive writes, redundant reads, or uncommitted changes. Issues warnings and can halt execution to prevent token waste.

### Database Schema

**users:** Authentication data, encrypted API keys, tier info, token usage, subscription status, rate limiting data

**chats:** Game projects with links to users, agent threads, Git repos, and processing state

**messages:** Conversation history with text, sender, and token counts

**usage:** Global free tier metrics, daily caps, reset timestamps (managed by cron jobs)

### Development Workflow

1. User creates chat, Freestyle provisions Git repo (30-60s, shows "pending" state)
2. User describes game, AI generates GDD with concept, mechanics, and visual style
3. User approves, AI writes game files (scene, player, obstacles, physics, state, UI, entry point)
4. AI commits, build verification runs (TypeScript, Babel, Metro checks)
5. Errors detected, AI auto-fixes and recommits
6. Success: dev server rebuilds, preview updates automatically

### API Key Management

User-provided keys are validated via test API call (10s timeout), encrypted, and stored. Rate limited to 3 updates per 5-minute window.

**Key Priority Hierarchy:**
1. Pro tier: Use Pro key (if allowance remains)
2. Pro tier (depleted): Fall back to user's BYOK
3. BYOK tier: Use user's key
4. Free tier: Shared system key with daily limits
5. Admin: System-wide default key

### Freestyle Integration

Freestyle Sandboxes provides isolated Git repos and dev servers. Each chat gets a repo initialized with an Expo template (React Native, Expo Router, React-Three-Fiber, Rapier, Zustand). The AI interacts via MCP server tools for file operations and Git workflows.

Commits trigger automatic dev server restarts. The frontend `FreestyleDevServer` component renders the Expo app in an iframe and refreshes on new commits. Users can download complete project source as zip at any time.

## Configuration

**Environment Variables:**
```
CONVEX_DEPLOYMENT=<convex-deployment-url>
NEXT_PUBLIC_CONVEX_URL=<convex-url>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk-key>
CLERK_SECRET_KEY=<clerk-secret>
OPENAI_API_KEY=<optional-system-key>
FREESTYLE_API_KEY=<freestyle-key>
```

**Key Settings** (`convex/config.ts`):
- Free tier: 5 messages/day, 1M token daily cap
- Pro tier: 7M tokens/month
- Rate limits: API key updates, chat creation, message sending
- Agent: Max steps, throttling, model selection

## Development

```bash
npm install
npm run dev           # Frontend at localhost:3000
npx convex dev        # Backend (separate terminal)
```

**Project Structure:**
```
app/           # Next.js pages (main, settings, layout)
components/    # React components (chat, landing, settings, ui)
convex/        # Backend functions (agent, chat, users, schema)
lib/           # Freestyle client and server actions
hooks/         # React hooks (useTheme)
```

## Game Development Approach

**Visual Design:**
- Geometric primitives only (spheres, boxes, cylinders, cones) - no external 3D models
- Harmonious color palettes with high contrast
- Gradient backgrounds, soft grids, or fog for depth
- Example: Character = sphere (head) + cone (body) + cylinders (limbs)

**Technical Stack:**
- React-Three-Fiber for 3D rendering
- Rapier for physics
- Zustand for high-frequency state (scores, positions)
- Expo-AV for audio, Expo-Haptics for feedback
- Pointer events and `@use-gesture/react` for mobile input

**Performance:**
- Low polygon counts
- Minimal post-processing
- Expo-GL compatibility
- Efficient `useFrame` usage

## Error Handling

**Build Verification** (runs after each commit):
- TypeScript checking (`tsc --noEmit`)
- Babel syntax validation
- Metro bundler log scanning

Errors are sent to the agent with file paths and line numbers. The agent must fix them before the commit succeeds.

**Agent Monitoring:**
- Detects repetitive file writes (potential loops)
- Prevents redundant file reads
- Ensures commits happen after modifications
- Issues warnings and can halt execution to prevent token waste

## Billing and Usage Tracking

**Per-User Tracking:**
- Free tier: Daily message count (resets midnight UTC)
- All tiers: Token consumption per message
- Pro tier: Tokens used in current billing period vs monthly allowance

**Global Tracking:**
- Total free tier tokens/day across all users
- Cap enforcement (blocks free tier when exceeded)
- Cron jobs handle daily resets (`convex/crons.ts`)

## Security

- API keys encrypted before storage, never returned in plaintext
- Clerk handles authentication, Convex validates on every request
- Query-level authorization for all data access
- Rate limiting on chat creation, messages, and API key updates
- Repository access scoped per user via Freestyle
- Agent file access restricted to `/template` directory per repo

## License

This project is private and proprietary.
