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
        languageModel: openai("gpt-5-mini"),
        instructions: 
`You are Kayra, the Game Creator - an expert 3D mobile game builder using Expo Router, React Native, and react-three-fiber.

CORE PRINCIPLES
1. NEW games → Design doc first, get approval, then build
2. EXISTING games → Implement changes directly
3. ALWAYS explain briefly what you're doing as you work
4. ALWAYS commit changes with commitAndPush after creating/updating files
5. NEVER show code snippets - users see results in preview
6. Keep responses concise - short paragraphs or bullets, not essays
7. **CRITICAL**: If commitAndPush reports errors, fix them IMMEDIATELY before proceeding

WORKFLOW

PHASE 1: DESIGN (New Games Only)
When user requests a new game:

1. Create a SHORT design document:

GAME DESIGN DOCUMENT
Game Name: [Creative name]
Concept: [One sentence pitch]
Core Mechanics:
[Main gameplay loop]
[Player actions/controls]
[Win/lose conditions]
Visual Style:
[3D objects - spheres, boxes, cylinders, etc.]
[Colors and aesthetics]
Mobile Controls:
[Touch interactions - tap, swipe, hold]
"Does this sound good? Any changes before I build?"

2. WAIT for user approval
3. Iterate if user wants changes
4. Write the design document to a file and proceed to Phase 2 only after approval

PHASE 2: IMPLEMENTATION (After Approval or For Updates)
1. List files to see current structure
2. Create brief implementation plan (2-4 steps):
"Here's my plan:

Create GameScene with player and physics
Add touch controls
Generate obstacles
Implement collision detection and scoring"

3. Check the design document and update if user's response require you to make design changes
4. Read relevant template files if needed
5. CREATE/UPDATE game files with complete, working code
6. COMMIT changes with descriptive message
7. Explain what you created and how the game works

ITERATION: For changes to existing games, skip Phase 1 and go straight to Phase 2

PROJECT STRUCTURE
CRITICAL: The folder is literally named "(tabs)" - parentheses included!
/template/
├── app/
│   ├── _layout.tsx          (Don't modify)
│   └── (tabs)/              (Parentheses are part of the name!)
│       ├── index.tsx        ← REPLACE with your game
│       └── explore.tsx      (Can modify or ignore)
└── components/
└── YourComponents.tsx   ← Game components here

IMPORT RULES:
From /template/app/(tabs)/index.tsx to components:
"""typescript
import GameScene from '../../components/GameScene'
// TWO dots: ../../components/ (up two levels, then into components)
"""

File paths:
- Main screen: "/template/app/(tabs)/index.tsx"
- Components: "/template/components/ComponentName.tsx"

DO NOT:
- Create index.ts barrel files
- Use export/import barrel patterns
- Create /template/app/components/ (wrong location!)

If "module not found" errors occur, use listDirectory to verify structure first

REACT-THREE-FIBER BASICS
**Basic Structure:**
"""typescript
import { Canvas } from '@react-three/fiber'

<Canvas>
  <ambientLight />
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="hotpink" />
  </mesh>
</Canvas>
"""

1. NEVER put <Text> inside <Canvas> (use absolute positioned RN Views instead).
2. Check "package.json" before importing "@react-three/drei".
3. If using "drei", prefer imports from "@react-three/drei/native" where available.
4. NEVER use useFrame or useThree in the parent component containing the <Canvas>. Create a separate component (e.g., <GameLogic />) inside the Canvas to handle loops and 3D logic. Pattern: index.tsx holds the <Canvas>, GameScene.tsx holds the useFrame.

**Common Elements:**
- Geometries: boxGeometry, sphereGeometry, planeGeometry, cylinderGeometry
- Materials: meshStandardMaterial, meshBasicMaterial, meshPhongMaterial
- Animations: useFrame hook for updates
- Touch: onPointerDown, onPointerUp props on mesh

**Game Patterns:**
1. Simple: Basic shapes, touch interactions, score tracking
2. Physics: Collision detection with bounds checking
3. Animations: useFrame for position/rotation updates
4. Mobile-first: Large touch targets, simple controls, clear visuals

MOBILE & TYPESCRIPT REQUIREMENTS
**Mobile Considerations:**
- Optimize for phone performance
- Use touch events (onPointerDown), not clicks
- Keep geometry counts reasonable (< 1000 vertices)
- Test expo-gl compatibility

**TypeScript Requirements:**
- All files must be .tsx (React) or .ts (utilities)
- Properly type props, state, refs
- Import types from '@react-three/fiber' for Three.js

TOOLS (Freestyle MCP)
- "listDirectory": List directory contents
- "readFile": Read file contents
- "writeFile": Write file to repository
- "editFile": Search and replace in files
- "exec": Run commands (e.g., npm install)
- "commitAndPush": Commit to git (REQUIRED after file changes!)

ERROR RECOVERY
**Common Issues:**
- "Module not found" → Use listDirectory to verify paths, fix imports
- "File not found" → Verify writing to correct /template/ paths
- Import errors → Use readFile to inspect actual file content
- **Build/TypeScript errors from commitAndPush:**
  1. Read files mentioned in error messages
  2. Identify specific issues (typos, wrong imports, type errors)
  3. Fix using writeFile or editFile
  4. Commit again to verify fixes
  5. Repeat until all errors resolved

**Remember:**
- Never create multiple index.ts files
- Keep imports direct and simple
- Always fix errors before responding to user
- Use listDirectory when unsure about file structure

 COMMUNICATION STYLE
- Brief, focused responses
- Explain WHAT the game does, not HOW it's coded
- No code snippets (users see preview)
- Use short paragraphs or bullet points
- Focus on gameplay, controls, and player experience`,
    });
}

/**
 * Tracks tool call patterns to detect potential infinite loops.
 * Monitors for:
 * - Writing to the same file 3+ times
 * - Repetitive write->read->write patterns
 */
class ToolCallTracker {
    private fileWriteCounts: Map<string, number> = new Map();
    private recentOperations: Array<{ type: 'read' | 'write', path: string }> = [];
    private warningIssued: boolean = false;
    
    recordWrite(path: string): { shouldWarn: boolean; shouldStop: boolean; message?: string } {
        // Track write count for this file
        const count = (this.fileWriteCounts.get(path) || 0) + 1;
        this.fileWriteCounts.set(path, count);
        
        // Track operation sequence
        this.recentOperations.push({ type: 'write', path });
        if (this.recentOperations.length > 10) {
            this.recentOperations.shift();
        }
        
        // Check for same file written 3+ times
        if (count >= 4 && this.warningIssued) {
            return { 
                shouldWarn: false, 
                shouldStop: true, 
                message: `🛑 LOOP DETECTED: You've written to "${path}" ${count} times. Stopping to prevent infinite loop. Please review your approach.`
            };
        }
        
        if (count >= 3) {
            this.warningIssued = true;
            return { 
                shouldWarn: true, 
                shouldStop: false, 
                message: `⚠️ WARNING: You've written to "${path}" ${count} times in this response. This may indicate a loop. Please complete your current task and respond to the user. If you continue this pattern, your response will be stopped.`
            };
        }
        
        // Check for write->read->write->read pattern
        if (this.detectWriteReadLoop()) {
            if (this.warningIssued) {
                return {
                    shouldWarn: false,
                    shouldStop: true,
                    message: `🛑 LOOP DETECTED: Repetitive write->read->write pattern detected. Stopping to prevent infinite loop.`
                };
            }
            this.warningIssued = true;
            return {
                shouldWarn: true,
                shouldStop: false,
                message: `⚠️ WARNING: Detected repetitive write->read->write pattern. This may indicate a loop. Please finish your task and respond to the user. If this pattern continues, your response will be stopped.`
            };
        }
        
        return { shouldWarn: false, shouldStop: false };
    }
    
    recordRead(path: string): { shouldWarn: boolean; shouldStop: boolean; message?: string } {
        this.recentOperations.push({ type: 'read', path });
        if (this.recentOperations.length > 10) {
            this.recentOperations.shift();
        }
        
        // Check for write->read->write->read pattern after a read
        if (this.detectWriteReadLoop()) {
            if (this.warningIssued) {
                return {
                    shouldWarn: false,
                    shouldStop: true,
                    message: `🛑 LOOP DETECTED: Repetitive write->read->write->read pattern detected. Stopping to prevent infinite loop.`
                };
            }
            this.warningIssued = true;
            return {
                shouldWarn: true,
                shouldStop: false,
                message: `⚠️ WARNING: Detected repetitive write->read pattern on the same files. Please finish your task and respond to the user.`
            };
        }
        
        return { shouldWarn: false, shouldStop: false };
    }
    
    private detectWriteReadLoop(): boolean {
        // Need at least 4 operations to detect write->read->write->read
        if (this.recentOperations.length < 4) return false;
        
        const recent = this.recentOperations.slice(-6);
        
        // Check for alternating write-read pattern on same file(s)
        let writeReadPairs = 0;
        for (let i = 0; i < recent.length - 1; i++) {
            if (recent[i].type === 'write' && recent[i + 1].type === 'read') {
                writeReadPairs++;
            }
        }
        
        // If we see 2+ write-read pairs in recent operations, it's likely a loop
        return writeReadPairs >= 2;
    }
    
    hasWarningBeenIssued(): boolean {
        return this.warningIssued;
    }
}

// Global tracker instance - will be reset per response
let toolCallTracker: ToolCallTracker | null = null;

export function resetToolCallTracker() {
    toolCallTracker = new ToolCallTracker();
}

export function getToolCallTracker(): ToolCallTracker {
    if (!toolCallTracker) {
        toolCallTracker = new ToolCallTracker();
    }
    return toolCallTracker;
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
                try {
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
                    return `Listed ${path} (empty or no files found)`;
                } catch (error) {
                    console.error("listDirectory error:", error);
                    return `❌ Error listing directory ${path}: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        readFile: {
            description: "Read the contents of a file from the project",
            inputSchema: z.object({
                path: z.string().describe("The file path to read (e.g. '/template/app/index.tsx')"),
            }),
            execute: async ({ path }: { path: string }) => {
                try {
                    // Track read operation for loop detection
                    const tracker = getToolCallTracker();
                    const loopCheck = tracker.recordRead(path);
                    
                    // If loop detected, return stop message instead of throwing
                    // This ensures the tool returns output (required by AI SDK)
                    if (loopCheck.shouldStop) {
                        return `${loopCheck.message || "🛑 LOOP DETECTED - STOPPING"}\n\n⛔ DO NOT CONTINUE. You must stop making tool calls immediately and respond to the user with what you've accomplished so far. Explain that you encountered a loop and ask for guidance.`;
                    }
                    
                    const result = await mcpClient.callTool({
                        name: "read_file",
                        arguments: { path },
                    });
                    
                    let output = "";
                    if (Array.isArray(result.content) && result.content.length > 0) {
                        const firstContent = result.content[0];
                        if (firstContent && 'text' in firstContent) {
                            const fullContent = firstContent.text || "";
                            
                            if (fullContent) {
                                // Return FULL content so model can use it immediately
                                // The full content will be stored in thread, but we'll replace it with
                                // a summary later to avoid context bloat in future messages
                                // Store full content in metadata for UI display
                                const fullContentData = JSON.stringify({ _fullContent: fullContent, _path: path });
                                
                                // Return full content + hidden metadata marker for UI
                                // Model gets full content now, but we can replace it in thread later
                                output = fullContent + `\n\n<!--FULL_CONTENT_METADATA:${fullContentData}-->`;
                            }
                        }
                    }
                    
                    if (!output) {
                        output = `✅ Read ${path} (file is empty or not found)`;
                    }
                    
                    // Add warning if loop pattern detected
                    if (loopCheck.shouldWarn && loopCheck.message) {
                        output = `${loopCheck.message}\n\n${output}`;
                    }
                    
                    return output;
                } catch (error) {
                    console.error("readFile error:", error);
                    return `❌ Error reading file ${path}: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        writeFile: {
            description: "Write content to a file in the project. Creates the file if it doesn't exist.",
            inputSchema: z.object({
                path: z.string().describe("The file path to write (e.g. '/template/app/index.tsx')"),
                content: z.string().describe("The full file content to write"),
            }),
            execute: async ({ path, content }: { path: string; content: string }) => {
                try {
                    // Track write operation for loop detection
                    const tracker = getToolCallTracker();
                    const loopCheck = tracker.recordWrite(path);
                    
                    // If loop detected, return stop message instead of throwing
                    // This ensures the tool returns output (required by AI SDK)
                    // Note: We DON'T write the file when stopping - just return the message
                    if (loopCheck.shouldStop) {
                        return `${loopCheck.message || "🛑 LOOP DETECTED - STOPPING"}\n\n⛔ FILE NOT WRITTEN. You must stop making tool calls immediately and respond to the user with what you've accomplished so far. Explain that you encountered a loop and ask for guidance.`;
                    }
                    
                    await mcpClient.callTool({
                        name: "write_file",
                        arguments: { path, content },
                    });
                    
                    // Return concise summary for model context (saves tokens)
                    // Note: Full content is in tool call arguments (content parameter) for UI display
                    const lines = content.split('\n');
                    const lineCount = lines.length;
                    const charCount = content.length;
                    
                    // Extract key information for summary
                    const importLines = lines.filter((line: string) => line.trim().startsWith('import')).slice(0, 3);
                    const exportLines = lines.filter((line: string) => line.includes('export')).slice(0, 2);
                    const mainComponent = lines.find((line: string) => 
                        line.includes('export default') || 
                        line.includes('export function') ||
                        line.includes('export const')
                    );
                    
                    let summary = `✅ Wrote ${path}\n📊 ${lineCount} lines, ${charCount} characters\n`;
                    
                    if (importLines.length > 0) {
                        summary += `Imports: ${importLines.join(', ').substring(0, 150)}...\n`;
                    }
                    if (exportLines.length > 0) {
                        summary += `Exports: ${exportLines.join(', ').substring(0, 150)}...\n`;
                    }
                    if (mainComponent) {
                        summary += `Main: ${mainComponent.substring(0, 100)}...\n`;
                    }
                    
                    // Include first 5 lines for context
                    summary += `\nFirst 5 lines:\n${lines.slice(0, 5).join('\n')}\n`;
                    if (lines.length > 5) {
                        summary += `\n... (${lines.length - 5} more lines written) ...\n`;
                    }
                    
                    // Add warning if loop pattern detected
                    if (loopCheck.shouldWarn && loopCheck.message) {
                        summary = `${loopCheck.message}\n\n${summary}`;
                    }
                    
                    return summary;
                } catch (error) {
                    console.error("writeFile error:", error);
                    return `❌ Error writing file ${path}: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        commitAndPush: {
            description: "Commit all changes to git with a descriptive message. ALWAYS use this after creating or modifying files. This will automatically check for TypeScript/build errors and report them if found.",
            inputSchema: z.object({
                message: z.string().describe("A descriptive commit message (e.g. 'Created spinning cube game')"),
            }),
            execute: async ({ message }: { message: string }) => {
                try {
                    // First, commit the changes
                    const commitResult = await mcpClient.callTool({
                        name: "git_commit_and_push",
                        arguments: { message },
                    });
                    
                    let commitOutput = `✅ Committed: ${message}`;
                    if (Array.isArray(commitResult.content) && commitResult.content.length > 0) {
                        const firstContent = commitResult.content[0];
                        if (firstContent && 'text' in firstContent) {
                            commitOutput = firstContent.text || commitOutput;
                        }
                    }

                    // Check for TypeScript/build errors after committing
                    try {
                        // Wait a moment for the dev server to process the changes
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const errors: string[] = [];
                        
                        // Check 1: TypeScript errors
                        const tscResult = await mcpClient.callTool({
                            name: "exec",
                            arguments: { command: "cd /template && (npx tsc --noEmit 2>&1 || echo 'TypeScript check completed')" },
                        });
                        
                        let tscOutput = "";
                        if (Array.isArray(tscResult.content) && tscResult.content.length > 0) {
                            const firstContent = tscResult.content[0];
                            if (firstContent && 'text' in firstContent) {
                                tscOutput = firstContent.text || "";
                            }
                        }
                        
                        // If there are TypeScript errors, collect them
                        if (tscOutput && 
                            tscOutput.trim() && 
                            !tscOutput.includes("Found 0 errors") &&
                            (tscOutput.includes("error TS") || tscOutput.includes("error:"))) {
                            const errorLines = tscOutput.split('\n')
                                .filter(line => line.includes('error') || line.trim().startsWith('/'))
                                .slice(0, 20)
                                .join('\n');
                            if (errorLines.trim()) {
                                errors.push(`TYPESCRIPT ERRORS:\n${errorLines}`);
                            }
                        }
                        
                        // Check 2: Babel/JSX syntax errors using npx babel
                        // This catches syntax errors that TypeScript might miss
                        const babelResult = await mcpClient.callTool({
                            name: "exec",
                            arguments: { 
                                command: "cd /template && find . -name '*.tsx' -o -name '*.ts' | grep -v node_modules | head -20 | xargs -I {} sh -c 'npx babel {} --presets=@babel/preset-typescript,@babel/preset-react -o /dev/null 2>&1 || echo \"BABEL_ERROR_IN: {}\"' 2>&1 | grep -E '(SyntaxError|Error:|BABEL_ERROR_IN)' | head -30" 
                            },
                        });
                        
                        let babelOutput = "";
                        if (Array.isArray(babelResult.content) && babelResult.content.length > 0) {
                            const firstContent = babelResult.content[0];
                            if (firstContent && 'text' in firstContent) {
                                babelOutput = firstContent.text || "";
                            }
                        }
                        
                        if (babelOutput && babelOutput.trim() && 
                            (babelOutput.includes("SyntaxError") || babelOutput.includes("Unexpected token"))) {
                            errors.push(`JSX/SYNTAX ERRORS:\n${babelOutput.trim()}`);
                        }
                        
                        // Check 3: Try to catch Metro bundler errors by checking recent logs
                        const metroResult = await mcpClient.callTool({
                            name: "exec",
                            arguments: { 
                                command: "cd /template && (cat .expo/logs/*.log 2>/dev/null | tail -50 | grep -iE '(error|failed|SyntaxError|unexpected)' | head -20) || echo ''" 
                            },
                        });
                        
                        let metroOutput = "";
                        if (Array.isArray(metroResult.content) && metroResult.content.length > 0) {
                            const firstContent = metroResult.content[0];
                            if (firstContent && 'text' in firstContent) {
                                metroOutput = firstContent.text || "";
                            }
                        }
                        
                        if (metroOutput && metroOutput.trim() && 
                            (metroOutput.includes("SyntaxError") || metroOutput.includes("Unexpected token"))) {
                            errors.push(`METRO/BUNDLER ERRORS:\n${metroOutput.trim()}`);
                        }
                        
                        // If any errors were found, report them
                        if (errors.length > 0) {
                            return `${commitOutput}\n\n❌ BUILD ERRORS DETECTED:\n\n${errors.join('\n\n')}\n\n⚠️ CRITICAL: You must fix these errors immediately. Read the affected files using readFile, identify the issues (look for syntax errors like missing commas, brackets, or unexpected tokens), and fix them using writeFile, then commit again.`;
                        }
                        
                    } catch (error) {
                        // If error checking fails, still return the commit success
                        console.error("Error checking for build errors:", error);
                    }
                    
                    return commitOutput;
                } catch (error) {
                    console.error("commitAndPush error:", error);
                    return `❌ Error committing: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        exec: {
            description: "Execute a shell command in the project directory (e.g. npm install)",
            inputSchema: z.object({
                command: z.string().describe("The command to execute"),
            }),
            execute: async ({ command }: { command: string }) => {
                try {
                    const result = await mcpClient.callTool({
                        name: "exec",
                        arguments: { command },
                    });
                    
                    if (Array.isArray(result.content) && result.content.length > 0) {
                        const firstContent = result.content[0];
                        if (firstContent && 'text' in firstContent) {
                            return firstContent.text || `✅ Executed: ${command}`;
                        }
                    }
                    return `✅ Executed: ${command}`;
                } catch (error) {
                    console.error("exec error:", error);
                    return `❌ Error executing command "${command}": ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
    };
}

