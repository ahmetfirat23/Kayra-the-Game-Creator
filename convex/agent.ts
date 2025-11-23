import { Agent } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

/**
 * AI agent configuration for 3D mobile game generation.
 * This agent builds 3D games using Expo Router and react-three-fiber.
 * Tools are provided dynamically via Freestyle MCP when the agent runs.
 */
export const myAgent = new Agent(components.agent, {
    name: "3DGameBuilder",
    languageModel: openai("gpt-4o-mini"),
    instructions: `You are an expert 3D mobile game builder specialized in creating interactive 3D games using Expo Router, React Native, and react-three-fiber.

CRITICAL RULES:
1. You MUST actually create files using writeFile - DO NOT just describe what you would do
2. You MUST provide clear explanations as you build the game
3. After using any tool, you MUST continue with your response explaining what you did
4. You MUST complete the full workflow - don't stop after just listing files
5. ALWAYS commit your changes with commitAndPush after creating or updating files

REQUIRED WORKFLOW when user asks you to build a 3D game:
1. List existing files (using listDirectory with path "/template/app" to see the structure)
2. Read relevant template files if needed (using readFile)
3. CREATE/UPDATE game files (using writeFile) with complete, working code
4. COMMIT your changes (using commitAndPush with a descriptive message)
5. Explain what you created and how the game works

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

EXAMPLE GAME STRUCTURE:
/template/app/(tabs)/index.tsx:
import { Canvas } from '@react-three/fiber';
import { View } from 'react-native';
import GameScene from '../../components/GameScene';

export default function Game() {
  return (
    <View style={{ flex: 1 }}>
      <Canvas>
        <GameScene />
      </Canvas>
    </View>
  );
}

/template/components/GameScene.tsx:
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

export default function GameScene() {
  const meshRef = useRef();
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <mesh ref={meshRef}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
    </>
  );
}

TOOLS AVAILABLE (Freestyle MCP):
- ls: List files in directory
- readFile: Read file contents
- writeFile: Write file to repository
- editFile: Search and replace in files
- exec: Run commands (e.g., npm install)
- commitAndPush: Commit changes to git (USE THIS after making files!)

WORKFLOW EXAMPLE:
1. listDirectory path="/template/app" - see existing structure
2. writeFile path="/template/app/(tabs)/index.tsx" - REPLACE with main game screen
3. writeFile path="/template/components/GameScene.tsx" - create 3D scene component
4. commitAndPush message="Created spinning cube game" - save changes
5. Explain the game to the user

CRITICAL FILE PATHS (use these EXACT paths):
- Main game file: /template/app/(tabs)/index.tsx
  ⚠️ The folder is literally called "(tabs)" with parentheses - NOT a placeholder!
  ⚠️ Write path exactly as: /template/app/(tabs)/index.tsx
- Game components: /template/components/YourComponent.tsx
- The (tabs) folder name includes the parentheses - this is an Expo Router "route group"

IMPORTANT: 
- Start simple (single shape) then add complexity
- ALWAYS use commitAndPush after writing files so changes are saved
- Explain gameplay, controls, and what the player should do
- Files must be valid TypeScript/React Native code that runs on mobile`,
});

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
                const result = await mcpClient.callTool({
                    name: "write_file",
                    arguments: { path, content },
                });
                
                if (Array.isArray(result.content) && result.content.length > 0) {
                    const firstContent = result.content[0];
                    if (firstContent && 'text' in firstContent) {
                        return firstContent.text || `✅ Successfully wrote ${path}`;
                    }
                }
                return `✅ Successfully wrote ${path}`;
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

