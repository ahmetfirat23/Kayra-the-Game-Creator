# 3D Game Builder Setup Guide

## Overview

This project has been transformed into a **3D Mobile Game Builder** that uses:
- **Expo Router + React Native** for mobile app structure
- **react-three-fiber** for 3D graphics
- **Freestyle** for Git repositories, dev servers, and live previews
- **Convex** for backend (chat history, messages)
- **Convex Agent** for AI-powered game generation

## Architecture

```
User sends message → Convex Agent → Freestyle MCP Tools → Git Repo → Dev Server → Live Preview
```

### Key Components

1. **Freestyle Git Repositories**: Each chat gets its own Git repo based on the Expo template
2. **Freestyle Dev Servers**: Run the Expo app and provide live preview URL
3. **MCP Tools**: Provided by Freestyle dev server (writeFile, readFile, ls, exec, commitAndPush, etc.)
4. **Convex Agent**: Uses GPT-4o-mini with workflow support (up to 15 steps)
5. **Split UI**: Chat on left (40%), Live preview on right (60%)

## Setup Instructions

### 1. Environment Variables

Create `/Users/afg/Documents/Bloom/game-builder/.env.local`:

```bash
# Required
FREESTYLE_API_KEY=your_freestyle_api_key_here
CONVEX_DEPLOYMENT=your_convex_deployment_here
NEXT_PUBLIC_CONVEX_URL=your_convex_url_here

# Already configured in Convex dashboard
# OPENAI_API_KEY=sk-proj-...
```

Get your Freestyle API key from: https://admin.freestyle.sh

### 2. Install Dependencies

Already installed:
- `freestyle-sandboxes` - Freestyle client library
- `@modelcontextprotocol/sdk` - MCP client for tool integration  
- `@convex-dev/agent` - Convex Agent library
- `@ai-sdk/openai` - OpenAI integration

### 3. Start Development Servers

**Terminal 1 - Convex:**
```bash
npx convex dev
```

**Terminal 2 - Next.js:**
```bash
npm run dev
```

### 4. Test the Integration

1. Open http://localhost:3000
2. Click "+ New" to create a 3D game project
3. Wait for Freestyle repo to be created (shows loading state)
4. Send message: "Create a spinning cube game"
5. Watch the agent:
   - List files in the repo
   - Write game files (app/index.tsx, components/GameScene.tsx, etc.)
   - Commit changes
   - Explain the game
6. See live preview on the right side (Expo dev server)

## How It Works

### Chat Creation Flow

1. User clicks "+ New"
2. `createChat` mutation creates chat record
3. `createAndAttachRepo` action creates Freestyle Git repo
4. Repo created from template: `https://github.com/freestyle-sh/freestyle-expo`
5. RepoId stored in chat record

### Message Processing Flow

1. User sends message
2. `sendMessage` saves user message to Convex
3. `processMessage` action is scheduled:
   - Requests Freestyle dev server for the repo
   - Connects to MCP server at dev server's MCP URL
   - Gets tools from MCP (writeFile, readFile, ls, exec, commitAndPush, etc.)
   - Converts MCP tools to AI SDK format
   - Calls `generateResponseWithTools` with tools
4. Agent workflow runs (up to 15 steps):
   - Calls tools as needed (ls, writeFile, commitAndPush, etc.)
   - Generates text explaining actions
   - Streams response back to UI
5. Final response saved to Convex messages table

### Live Preview

- `FreestyleDevServer` React component keeps dev server alive
- Shows Expo app running in dev server
- Auto-refreshes when agent commits changes
- Provides QR code for testing on physical device

## File Structure

```
convex/
  agent.ts              - Agent configuration with 3D game instructions
  chat.ts               - Chat CRUD, message handling, MCP integration
  schema.ts             - Database schema (chats, messages)
  
app/
  page.tsx              - Split UI: chat + live preview
  
lib/
  freestyle.ts          - Freestyle client singleton
  freestyle-actions.ts  - Server actions for dev server
```

## Agent Instructions

The agent is configured to build 3D mobile games with:
- Expo Router file structure  
- react-three-fiber components
- Mobile-friendly touch controls
- Performance considerations
- Incremental commits with descriptive messages

## Troubleshooting

### Preview not loading
- Check that Freestyle API key is set
- Dev server takes 30-60s to start first time
- Check browser console for errors

### Agent not creating files
- Verify MCP connection in logs
- Check that repoId exists on chat
- Ensure dev server is running

### TypeScript errors in generated code
- Agent should create valid TypeScript
- If errors persist, ask agent to "fix TypeScript errors"

## Next Steps

- [ ] Test with physical device using Expo Go
- [ ] Add deployment support for publishing games
- [ ] Customize Expo template with react-three-fiber pre-installed
- [ ] Add more example prompts for users
- [ ] Implement error recovery if dev server fails

## Resources

- Freestyle Docs: https://docs.freestyle.sh
- Convex Agent Docs: https://docs.convex.dev/agents
- react-three-fiber: https://docs.pmnd.rs/react-three-fiber
- Expo Router: https://docs.expo.dev/router/introduction/

