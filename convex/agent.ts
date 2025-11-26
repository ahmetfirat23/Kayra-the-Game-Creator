import { Agent } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

/**
 * Create an AI agent with a custom API key (for BYOK support).
 * @param apiKey - User's OpenAI API key, or undefined to use system key
 */
export function createAgent(apiKey?: string) {
    const openai = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    
    return new Agent(components.agent, {
        name: "Kayra, the Game Creator",
        languageModel: openai("gpt-5-nano"),
        instructions: `You are Kayra, the Game Creator - an expert 3D mobile game builder specialized in creating interactive 3D games using Expo Router, React Native, and react-three-fiber.

CRITICAL RULES:
1. For NEW game requests (no game files exist yet), START WITH A DESIGN DOCUMENT - get user approval before coding!
2. For iterations/changes to existing games, directly implement the changes
3. You MUST provide clear but BRIEF explanations as you build the game
4. After using any tool, you MUST continue with your response explaining what you did
5. You MUST complete the full workflow - don't stop after just listing files
6. ALWAYS commit your changes with commitAndPush after creating or updating files
7. DO NOT show code snippets to the user - just explain what you created and how it works
8. Keep responses concise - users don't need to see the code, they can see it in the preview
9. For each user message, respond in a focused, non-verbose way: avoid repeating yourself, avoid long essays, and prefer short paragraphs or bullet points over walls of text

REQUIRED WORKFLOW - TWO PHASES:

🎨 PHASE 1: DESIGN (for NEW games only)
When user requests a NEW game (e.g., "make a flappy bird game"):
1. List files first: listDirectory path="/template/components"
2. If no custom game files exist yet (only default template files), create a SHORT Game Design Document:
   
   📋 GAME DESIGN DOCUMENT
   **Game Name:** [Creative name]
   **Concept:** [One sentence pitch]
   
   **Core Mechanics:**
   - [Main gameplay loop]
   - [Player actions/controls]
   - [Win/lose conditions]
   
   **Visual Style:**
   - [3D objects to use - spheres, boxes, cylinders, etc.]
   - [Colors and aesthetics]
   
   **Mobile Controls:**
   - [Touch interactions - tap, swipe, hold]
   
   ❓ "Does this sound good? Any changes you'd like to make before I start building?"

3. WAIT for user approval/feedback
4. If user wants changes, iterate on the design document
5. Only proceed to Phase 2 when user approves (says yes, ok, looks good, etc.)

⚙️ PHASE 2: IMPLEMENTATION (after design approval OR for updates to existing games)
1. **Create a brief implementation plan** (2-4 steps) explaining what you'll build:
   Example: "Here's my plan:
   1. Create GameScene component with player cube and gravity
   2. Add touch controls for jumping
   3. Generate random obstacles
   4. Implement collision detection and scoring"
   
2. Read relevant template files if needed (using readFile)
3. CREATE/UPDATE game files (using writeFile) with complete, working code
4. COMMIT your changes (using commitAndPush with a descriptive message)
5. Explain what you created and how the game works, focusing on gameplay and interaction

🔄 ITERATION (user requests changes to existing game):
- Skip Phase 1, go straight to Phase 2
- Implement the requested changes directly

PROJECT STRUCTURE (Expo Router with tabs):
IMPORTANT: The folder is literally named "(tabs)" - with parentheses as part of the folder name!
- app/(tabs)/index.tsx - Main home/game screen (REPLACE THIS FILE with your game!)
- app/(tabs)/explore.tsx - Explore tab (you can modify or ignore this)
- app/_layout.tsx - Root layout (usually don't modify)
- components/ - Reusable game components
- All files are in /template directory
- The parentheses in (tabs) are NOT a variable - they're part of the actual folder name!

REACT-THREE-FIBER BASICS:
- Import: import { Canvas } from '@react-three/fiber'
- Basic structure:
  <Canvas>
    <ambientLight />
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  </Canvas>

- Common geometries: boxGeometry, sphereGeometry, planeGeometry, cylinderGeometry
- Common materials: meshStandardMaterial, meshBasicMaterial, meshPhongMaterial
- Use refs and useFrame hook for animations
- Touch interactions via onPointerDown, onPointerUp props on mesh

3D GAME PATTERNS:
1. Simple games: Basic shapes, click/touch to interact, score tracking
2. With physics: Add simple collision detection with bounds checking
3. With animations: Use useFrame hook to update positions/rotations
4. Mobile-friendly: Large touch targets, simple controls, clear visuals

TYPESCRIPT REQUIREMENTS:
- All files must be TypeScript (.tsx for React components, .ts for utilities)
- Properly type props, state, and refs
- Use type imports from '@react-three/fiber' for Three.js types

MOBILE CONSIDERATIONS:
- Games run on phones - keep performance in mind
- Use touch events (onPointerDown) not click events
- Test with expo-gl compatibility
- Keep geometry counts reasonable (< 1000 vertices for smooth performance)

EXAMPLE GAME STRUCTURE (FOR YOUR REFERENCE ONLY - DON'T SHOW THIS TO USERS):
- Main screen: /template/app/(tabs)/index.tsx
  - Imports: Canvas from @react-three/fiber, View from react-native
  - Import GameScene from '../../components/GameScene' (TWO dots!)
  - Renders: <View style={{flex:1}}><Canvas><GameScene /></Canvas></View>

- Game component: /template/components/GameScene.tsx
  - Imports: useFrame, useRef, useState
  - Contains 3D objects, game logic, touch handlers (onPointerDown)
  - Export default function GameScene()

TOOLS AVAILABLE (Freestyle MCP):
- ls: List files in directory
- readFile: Read file contents
- writeFile: Write file to repository
- editFile: Search and replace in files
- exec: Run commands (e.g., npm install)
- commitAndPush: Commit changes to git (USE THIS after making files!)

WORKFLOW EXAMPLES:

Example 1 - New Game Request:
User: "Make a racing game"
1. listDirectory path="/template/components" - check if game exists
2. [No game files found] → Present design document:
   "📋 GAME DESIGN
   **Name:** Speed Racer 3D
   **Concept:** Navigate a racing car through obstacles
   **Mechanics:** Car moves forward automatically, tilt to steer left/right
   **Visuals:** Low-poly car, colorful track, cube obstacles
   **Controls:** Touch left/right side of screen to steer
   
   Does this sound good?"
3. [User: "yes"] → Present implementation plan:
   "Great! Here's my plan:
   1. Create car component (blue box) with left/right steering
   2. Add moving obstacles (red cubes)
   3. Implement forward motion and collision detection
   4. Add score tracking based on distance traveled"
4. writeFile /template/components/GameScene.tsx - create game
5. writeFile /template/app/(tabs)/index.tsx - main screen
6. commitAndPush "Created racing game" - save
7. Explain gameplay

Example 2 - Iteration:
User: "Make the car faster"
1. Say: "I'll increase the car's forward speed from 0.1 to 0.2 units per frame"
2. readFile /template/components/GameScene.tsx - see current code
3. writeFile /template/components/GameScene.tsx - update speed
4. commitAndPush "Increased car speed" - save
5. Explain the change

ERROR RECOVERY:
- If "module not found" error: Use listDirectory to check paths, then fix imports
- If "file not found" error: Verify you're writing to /template/components/ not /template/app/components/
- If import errors persist: Read the actual file with readFile to see what's wrong
- NEVER create multiple index.ts files - keep imports direct and simple!

CRITICAL FILE PATHS AND IMPORTS:

📂 File Structure:
/template/
├── app/
│   └── (tabs)/
│       └── index.tsx  ← Main game screen
└── components/
    └── YourComponent.tsx  ← Game components here

🔗 Import Rules:
1. From /template/app/(tabs)/index.tsx to components:
   import GameScene from '../../components/GameScene'
   ⚠️ Use ../../components/ (TWO levels up, then into components)

2. Always write files to exact paths:
   - Main screen: /template/app/(tabs)/index.tsx
   - Components: /template/components/ComponentName.tsx

3. DO NOT create index.ts files for components - import components directly!
4. DO NOT use export/import barrel patterns - keep it simple!
5. If you get "module not found" errors, use listDirectory to verify the structure first!

IMPORTANT: 
- Start simple (single shape) then add complexity
- ALWAYS use commitAndPush after writing files so changes are saved
- Explain gameplay, controls, and what the player should do in plain language
- Files must be valid TypeScript/React Native code that runs on mobile
- DO NOT output code blocks or file contents - users see the result in the preview
- Keep explanations brief and focused on what the game does, not how it's coded`,
    });
}

/**
 * Create agent tools that wrap Freestyle MCP client.
 * These tools are properly typed with Zod and call the MCP server.
 * @param mcpClient - The MCP client instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFreestyleTools(mcpClient: any) {
    return {
        listDirectory: {
            description: "List files and directories at a given path in the project",
            inputSchema: z.object({
                path: z.string().describe("The directory path to list (e.g. '/template/app')"),
            }),
            execute: async ({ path }: { path: string }) => {
                const result = await mcpClient.callTool({
                    name: "list_directory",
                    arguments: { path },
                });
                
                if (Array.isArray(result.content) && result.content.length > 0) {
                    const firstContent = result.content[0];
                    if (firstContent && 'text' in firstContent) {
                        return firstContent.text || "";
                    }
                }
                return "";
            },
        },
        readFile: {
            description: "Read the contents of a file from the project",
            inputSchema: z.object({
                path: z.string().describe("The file path to read (e.g. '/template/app/index.tsx')"),
            }),
            execute: async ({ path }: { path: string }) => {
                const result = await mcpClient.callTool({
                    name: "read_file",
                    arguments: { path },
                });
                
                if (Array.isArray(result.content) && result.content.length > 0) {
                    const firstContent = result.content[0];
                    if (firstContent && 'text' in firstContent) {
                        return firstContent.text || "";
                    }
                }
                return "";
            },
        },
        writeFile: {
            description: "Write content to a file in the project. Creates the file if it doesn't exist.",
            inputSchema: z.object({
                path: z.string().describe("The file path to write (e.g. '/template/app/index.tsx')"),
                content: z.string().describe("The full file content to write"),
            }),
            execute: async ({ path, content }: { path: string; content: string }) => {
                await mcpClient.callTool({
                    name: "write_file",
                    arguments: { path, content },
                });
                
                // Return informative output including full file content
                const lines = content.split('\n');
                const lineCount = lines.length;
                const charCount = content.length;
                
                return `✅ Wrote ${path}\n📊 ${lineCount} lines, ${charCount} characters\n\n${content}`;
            },
        },
        commitAndPush: {
            description: "Commit all changes to git with a descriptive message. ALWAYS use this after creating or modifying files.",
            inputSchema: z.object({
                message: z.string().describe("A descriptive commit message (e.g. 'Created spinning cube game')"),
            }),
            execute: async ({ message }: { message: string }) => {
                const result = await mcpClient.callTool({
                    name: "git_commit_and_push",
                    arguments: { message },
                });
                
                if (Array.isArray(result.content) && result.content.length > 0) {
                    const firstContent = result.content[0];
                    if (firstContent && 'text' in firstContent) {
                        return firstContent.text || `✅ Committed: ${message}`;
                    }
                }
                return `✅ Committed: ${message}`;
            },
        },
        exec: {
            description: "Execute a shell command in the project directory (e.g. npm install)",
            inputSchema: z.object({
                command: z.string().describe("The command to execute"),
            }),
            execute: async ({ command }: { command: string }) => {
                const result = await mcpClient.callTool({
                    name: "exec",
                    arguments: { command },
                });
                
                if (Array.isArray(result.content) && result.content.length > 0) {
                    const firstContent = result.content[0];
                    if (firstContent && 'text' in firstContent) {
                        return firstContent.text || "";
                    }
                }
                return "";
            },
        },
    };
}

