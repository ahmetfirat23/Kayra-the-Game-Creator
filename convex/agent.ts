import { Agent } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { CONFIG } from "./config";

/**
 * Create an AI agent with a custom API key.
 * @param apiKey - User's OpenAI API key, or undefined to use system key
 */
export function createAgent(apiKey?: string) {
    const openai = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    
    return new Agent(components.agent, {
        name: "Kayra, the Game Creator",
        languageModel: openai(CONFIG.LANGUAGE_MODEL),
        instructions: 
`# System Identity & Core Protocols

## Role
You are **Kayra**, an expert **3D Game Developer** specializing in **Hypercasual Games** using:
- Expo Router
- React Native
- React-Three-Fiber

Your goal is to build games that are **"Easy to learn, difficult to master"** with a strong focus on beautiful, geometric aesthetics.

---

## Core Rules

1. **Code Privacy**  
   Do not output code snippets in the chat. Write all code directly to the file system.

2. **Atomic Workflow**  
   Create or update files, then immediately run \`commitAndPush\`.  
   Do not batch too many changes without verification.

3. **Efficiency**  
   Plan before executing.  
   Do not read files you just modified.  
   Only read what is strictly necessary.

4. **Error Handling**  
   If a build or lint error occurs during a commit, fix it immediately before returning control to the user.

5. **User Communication**
    Keep your design documents and explanations concise and to the point.

---

## Visual & Design Philosophy (Mandatory)

### Geometric Beauty
Build assets by creatively combining simple 3D primitives:
- spheres
- boxes
- cylinders
- cones  

Do **not** ask for external models.

**Example:**  
A "Character" = Sphere (head) + Cone (body) + Cylinder (limbs)

### Color Theory
Use harmonious, high-contrast palettes typical of top hypercasual games:
- Pastel backgrounds
- Vibrant player and obstacle colors  

Avoid:
- Default white or black materials
- Unlit scenes

### Environment
Never leave the background empty.  
Use gradients, soft grids, or distant fog to create depth.

---

## Mobile Optimization Standards

### Input
- Use \`onPointerDown\` / \`onPointerUp\` for taps
- Implement swiping using \`@use-gesture/react\` or pointer movement logic
- Avoid \`onClick\` (latency) and mouse-specific events

### Performance
- Keep geometry simple (low vertex count)
- Avoid heavy post-processing

### Compatibility
- Ensure all logic is compatible with **Expo-GL**

---

## Workflow Protocols

### Phase 1: Design (New Games Only)

1. **Draft Design Document**  
   Give user a short **Game Design Document (GDD)** containing:
   - **Concept**: One-sentence pitch (Hypercasual focus)
   - **Mechanics**: Core loop (e.g., "Tap to Jump"), win/lose conditions
   - **Visual Style**: Color palette (hex codes or names) and primitive representations
   Your GDD must be concise and focus on the MVP. Don't overcomplicate.

2. **Save GDD**  
   After outputting the full design to user, write the same design to \`design.md\` in the root directory too. You don't need to commit yet.

3. **Wait for Approval**  
   Start coding after user approves the GDD. If user requests changes, update \`design.md\` accordingly.

---

### Phase 2: Implementation (New & Existing)

1. **Plan**  
   Create a brief implementation plan (bullet points) in chat. Then directly start coding.

2. **Verify Structure**  
   Ensure target directories exist (e.g., \`/template/app/(tabs)/\`) using \`listDirectory\` only once.

3. **Read Sparingly**
    Read only essential files. Avoid re-reading files you modified.
    When reading multiple files, always use \`readFiles\` with an array of paths in a single call rather than calling it multiple times.

4. **Write & Commit**
    Your main objective is to write code files. Write complete, bug-free, working files. When writing multiple files, always use \`writeFiles\` with an array of file objects in a single call rather than calling it multiple times. After each meaningful batch of changes, run \`commitAndPush\`. Your code should be compact, focusing on core functionality first.

5. **Commit**  
   Run \`commitAndPush\` after every meaningful file change or batch of changes.

6. **Review**  
   Briefly explain what you built and how it works.

**CRITICAL - STRATEGIC READS**: 
After user approves GDD:

Read ONLY these (once per session, if you don't have them in conversation history):
- \`package.json\` - to check dependencies
- \`/template/app/(tabs)/\` structure - to verify entry point

Do NOT read:
- Example game files you didn't create
- Components to "see patterns"
- Files multiple times

Then write code immediately.

---

## Technical Architecture & Structure

### Preferred Tech Stack (Use these libraries' functionalities)

- **State Management**: \`zustand\` (high-frequency game state like scores/health)
- **Physics**: \`@react-three/rapier\`
- **Audio**: \`expo-av\`
- **Haptics**: \`expo-haptics\`
- **Gestures**: \`@use-gesture/react\`

---

## Directory Standards

- **Game Entry**  
  \`/template/app/(tabs)/index.tsx\`

- **Components**  
  \`/template/components/\`

- **Forbidden**
  - Do not create \`index.ts\` barrel files
  - Do not use export/import barrel patterns (Metro bundler issues)

---

## React-Three-Fiber Constraints

- **Canvas Separation**  
  The \`<Canvas>\` component must live in \`index.tsx\`  
  Game logic (loops, physics) must live in a child component (e.g., \`<GameScene />\`)

- **No Frame Loops in Parent**  
  Never use \`useFrame\` or \`useThree\` inside the component that renders \`<Canvas>\`

- **UI Overlay**
  - Do not use 3D text for HUDs
  - Use absolute-positioned React Native \`<View>\` and \`<Text>\` overlaying the Canvas

---

## Tools & Error Recovery
### Approved Tools
- \`listDirectory\` — verify folder structure
- \`readFiles\` — read one or more file contents (only when necessary). ALWAYS pass an array of paths to read multiple files in a single call, never make separate calls for each file.
- \`writeFiles\` — create or overwrite files. ALWAYS pass an array of file objects to write multiple files in a single call, never make separate calls for each file.
- \`editFiles\` — make precise line edits. ALWAYS pass an array of file edit objects to edit multiple files in a single call, never make separate calls for each file.
- \`commitAndPush\` — save changes
- \`npmInstall\` — install dependencies
- \`exec\` — run shell commands

---

### Error Recovery Protocol

- **"Module not found"**
  - Use \`listDirectory\` to verify the path
  - If a package is missing update package.json and run \`npmInstall\`
  - Do not ask the user

- **"File not found"**
  - Verify you are writing to the correct \`/template/\` path

- **Build Errors**
  - If \`commitAndPush\` fails:
    1. Read the error log
    2. Identify the specific file/line
    3. Fix it using \`editFiles\` or \`writeFiles\`
    4. Retry the commit`,
    });
}

/**
 * Tracks tool call patterns to detect model pitfalls.
 * Monitors for:
 * - Writing to the same file 3+ times
 * - Reading the same file twice in a row
 * - Whether files were modified and committed
 */
class ToolCallTracker {
    private fileWriteCounts: Map<string, number> = new Map();
    private recentOperations: Array<{ type: 'read' | 'write' | 'commit', path?: string }> = [];
    private warningIssued: boolean = false;
    private hasFileModifications: boolean = false;
    private hasCommitted: boolean = false;

    hasWarningBeenIssued(): boolean {
        return this.warningIssued;
    }
    
    hasUncommittedChanges(): boolean {
        return this.hasFileModifications && !this.hasCommitted;
    }
    
    recordCommit(): void {
        this.hasCommitted = true;
        this.recentOperations.push({ type: 'commit' });
        if (this.recentOperations.length > 10) {
            this.recentOperations.shift();
        }
    }
    
    recordWrite(path: string): { shouldWarn: boolean; shouldStop: boolean; message?: string } {
        const count = (this.fileWriteCounts.get(path) || 0) + 1;
        this.fileWriteCounts.set(path, count);
        this.hasFileModifications = true;
        
        this.recentOperations.push({ type: 'write', path });
        if (this.recentOperations.length > 10) {
            this.recentOperations.shift();
        }
        
        if (count >= 4 && this.warningIssued) {
            return { 
                shouldWarn: false, 
                shouldStop: true, 
                message: `You've written to "${path}" ${count} times. Stopping your turn, Please review your approach.`
            };
        }
        
        if (count >= 3) {
            this.warningIssued = true;
            return { 
                shouldWarn: true, 
                shouldStop: false, 
                message: `You've written to "${path}" ${count} times in this response. Please complete your current task and respond to the user. If you continue this pattern, your response will be stopped.`
            };
        }
        
        return { shouldWarn: false, shouldStop: false };
    }
    
    recordRead(path: string): { shouldWarn: boolean; shouldStop: boolean; message?: string } {
        const previousRead = this.recentOperations.find(op => op.type === 'read' && op.path === path);
        
        if (previousRead) {
            if (this.warningIssued) {
                return {
                    shouldWarn: false,
                    shouldStop: true,
                    message: `You're reading "${path}" too many times. Stopping your turn. Please review your approach.`,
                };
            }
            this.warningIssued = true;
            return {
                shouldWarn: true,
                shouldStop: false,
                message: `You're reading "${path}" again. You already have this file's contents, use that information instead of re-reading. Please finish your task and respond to the user. If you continue this pattern, your response will be stopped.`,
            };
        }
        
        this.recentOperations.push({ type: 'read', path });
        if (this.recentOperations.length > 10) {
            this.recentOperations.shift();
        }
        
        return { shouldWarn: false, shouldStop: false };
    }

}

// Global tracker instance, will be reset per response
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
 */
export function createFreestyleTools(mcpClient: any) {
    return {
        listDirectory: {
            description: "List the whole directory structure of the project recursively",
            inputSchema: z.object({}),
            execute: async () => {
                try {
                    // Helper to recursively list directories with full paths
                    async function listRecursive(dirPath: string): Promise<string[]> {
                        const result = await mcpClient.callTool({
                            name: "list_directory",
                            arguments: { path: dirPath },
                        });
                        
                        let content = "";
                        if (Array.isArray(result.content) && result.content.length > 0) {
                            const firstContent = result.content[0];
                            if (firstContent && 'text' in firstContent) {
                                content = firstContent.text || "";
                            }
                        }
                        
                        if (!content) return [];
                        
                        const lines = content.split('\n').filter(l => l.trim());
                        let paths: string[] = [];
                        
                        for (const line of lines) {
                            // Skip total line and empty lines
                            if (line.startsWith('total ') || !line.trim()) continue;
                            
                            // Parse ls -la output format
                            // Format: drwxr-xr-x   2 root root   4096 Dec  5 10:53 .github
                            const parts = line.split(/\s+/);
                            if (parts.length < 9) continue;
                            
                            // The filename is the last part (index 8+)
                            const itemName = parts.slice(8).join(' ');
                            
                            // Skip . and .. entries
                            if (itemName === '.' || itemName === '..') continue;
                            
                            // Check if it's a directory (first char is 'd')
                            const isDirectory = parts[0].startsWith('d');
                            
                            const fullPath = `${dirPath}/${itemName}`.replace(/\/+/g, '/');
                            
                            if (isDirectory) {
                                paths.push(fullPath + '/');
                                // Recursively list subdirectories, but skip common ones to avoid huge output
                                if (itemName !== 'node_modules' && itemName !== '.git') {
                                    const subPaths = await listRecursive(fullPath);
                                    paths.push(...subPaths);
                                }
                            } else {
                                paths.push(fullPath);
                            }
                        }
                        
                        return paths;
                    }
                    
                    const allPaths = await listRecursive('/template');
                    // Sort paths for better readability
                    allPaths.sort();
                    const output = allPaths.join('\n');
                    return output || `Listed /template (empty or no files found)`;
                } catch (error) {
                    console.error("listDirectory error:", error);
                    return `Error listing directory /template: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        readFiles: {
            description: "Read the contents of one or more files from the project. CRITICAL: Always read multiple files in a single call by passing an array of paths. Never call this tool multiple times for individual files - batch them together.",
            inputSchema: z.object({
                paths: z.array(z.string()).describe("Array of file paths to read (e.g. ['/template/app/index.tsx', '/template/components/Player.tsx']). Always include ALL files you need to read in a single array."),
            }),
            execute: async ({ paths }: { paths: string[] }) => {
                try {
                    const tracker = getToolCallTracker();
                    const results: Array<{ path: string; content?: string; error?: string; warning?: string }> = [];
                    
                    for (const path of paths) {
                        const readCheck = tracker.recordRead(path);
                        if (readCheck.shouldStop) {
                            results.push({ path, error: readCheck.message });
                            continue;
                        }
                        
                        try {
                            const result = await mcpClient.callTool({
                                name: "read_file",
                                arguments: { path },
                            });
                            
                            let content = "";
                            if (Array.isArray(result.content) && result.content.length > 0) {
                                const firstContent = result.content[0];
                                if (firstContent && 'text' in firstContent) {
                                    content = firstContent.text || "";
                                }
                            }
                            
                            const fileResult: any = { path, content: content || "" };
                            
                            if (readCheck.shouldWarn && readCheck.message) {
                                fileResult.warning = readCheck.message;
                            }
                            
                            results.push(fileResult);
                        } catch (error) {
                            results.push({ 
                                path, 
                                error: `Error reading: ${error instanceof Error ? error.message : "Unknown error"}` 
                            });
                        }
                    }
                    
                    // Return structured data for UI to parse
                    return { _multiFileRead: true, files: results };
                } catch (error) {
                    console.error("readFiles error:", error);
                    return `Error reading files: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        writeFiles: {
            description: "Write complete content to one or more files in the project. Creates files if they don't exist, or overwrites them entirely. CRITICAL: Always write multiple files in a single call by passing an array of file objects. Never call this tool multiple times for individual files - batch them together. Use this for creating new files or making large changes to existing files. For small, targeted edits to existing files, use editFile instead.",
            inputSchema: z.object({
                files: z.array(z.object({
                    path: z.string().describe("The file path to write (e.g. '/template/app/index.tsx')"),
                    content: z.string().describe("The full file content to write"),
                })).describe("Array of file objects to write. Always include ALL files you need to write in a single array."),
            }),
            execute: async ({ files }: { files: Array<{ path: string; content: string }> }) => {
                try {
                    const tracker = getToolCallTracker();
                    const results: Array<{ path: string; success?: boolean; error?: string; warning?: string; lines?: number; chars?: number }> = [];
                    
                    // Check for duplicates within this batch
                    const pathCounts = new Map<string, number>();
                    const seenPaths = new Set<string>();
                    
                    for (const file of files) {
                        pathCounts.set(file.path, (pathCounts.get(file.path) || 0) + 1);
                    }
                    
                    for (const file of files) {
                        // Skip if we've already processed this path (only process the last occurrence)
                        const count = pathCounts.get(file.path) || 1;
                        const isFirstOccurrence = !seenPaths.has(file.path);
                        seenPaths.add(file.path);
                        
                        // If this is a duplicate and not the last occurrence, skip it with a warning
                        if (count > 1 && isFirstOccurrence) {
                            results.push({
                                path: file.path,
                                success: false,
                                warning: `Skipped: ${file.path} appears ${count} times in this batch. Only processing the last occurrence.`
                            });
                            continue;
                        } else if (count > 1 && seenPaths.size < files.length) {
                            // This is a middle duplicate, skip it silently
                            continue;
                        }
                        const writeCheck = tracker.recordWrite(file.path);
                        if (writeCheck.shouldStop) {
                            results.push({ path: file.path, success: false, error: writeCheck.message });
                            continue;
                        }
                        
                        try {
                            await mcpClient.callTool({
                                name: "write_file",
                                arguments: { path: file.path, content: file.content },
                            });
                            
                            const lines = file.content.split('\n');
                            const lineCount = lines.length;
                            const charCount = file.content.length;
                            
                            const fileResult: any = { 
                                path: file.path, 
                                success: true, 
                                lines: lineCount, 
                                chars: charCount 
                            };
                            
                            // Add tracker warnings if any
                            if (writeCheck.shouldWarn && writeCheck.message) {
                                fileResult.warning = writeCheck.message;
                            }
                            
                            results.push(fileResult);
                        } catch (error) {
                            results.push({ 
                                path: file.path, 
                                success: false,
                                error: `Error writing: ${error instanceof Error ? error.message : "Unknown error"}` 
                            });
                        }
                    }
                    
                    // Return structured data for UI to parse
                    return { _multiFileWrite: true, files: results };
                } catch (error) {
                    console.error("writeFiles error:", error);
                    return `Error writing files: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        commitAndPush: {
            description: "Commit all changes to git. Always use this after completing your work.",
            inputSchema: z.object({ }),
            execute: async () => {
                try {
                    getToolCallTracker().recordCommit();
                    
                    const commitResult = await mcpClient.callTool({
                        name: "git_commit_and_push",
                        arguments: { message: "committed" },
                    });
                    
                    let commitOutput = `Committed changes successfully.`;
                    if (Array.isArray(commitResult.content) && commitResult.content.length > 0) {
                        const firstContent = commitResult.content[0];
                        if (firstContent && 'text' in firstContent) {
                            commitOutput = firstContent.text || commitOutput;
                        }
                    }

                    try {
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
                        // Configure Babel with module-resolver to handle path aliases (@/...)
                        const babelResult = await mcpClient.callTool({
                            name: "exec",
                            arguments: { 
                                command: "cd /template && find . -name '*.tsx' -o -name '*.ts' | grep -v node_modules | head -20 | xargs -I {} sh -c 'npx babel {} --presets=@babel/preset-typescript,@babel/preset-react --plugins=[[\"module-resolver\",{\"alias\":{\"@\":\"./\"}}]] -o /dev/null 2>&1 || echo \"BABEL_ERROR_IN: {}\"' 2>&1 | grep -E '(SyntaxError|Error:|BABEL_ERROR_IN)' | grep -v 'Cannot find module' | head -30" 
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
                            return `${commitOutput}\n\nBUILD ERRORS DETECTED:\n\n${errors.join('\n\n')}\n\nCRITICAL: You must fix these errors immediately. Identify the issues (look for syntax errors like missing commas, brackets, or unexpected tokens), and fix them using writeFiles or editFiles, then commit again.`;
                        }
                        
                    } catch (error) {
                        // If error checking fails, still return the commit success
                        console.error("Error checking for build errors:", error);
                    }                 
                    return commitOutput;
                } catch (error) {
                    console.error("commitAndPush error:", error);
                    return `Error committing: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        editFiles: {
            description: "Make line-based edits to one or more existing files for small, targeted changes (e.g., fixing bugs, updating a few lines, changing functions). Always edit multiple files in a single call by passing an array of file edit objects. Don't call this tool multiple times for individual files, batch them together. Each edit replaces exact line sequences with new content. For large changes or rewriting significant portions of files, use writeFiles instead.",
            inputSchema: z.object({
                files: z.array(z.object({
                    path: z.string().describe("The file path to edit (e.g. '/template/app/index.tsx')"),
                    edits: z.array(z.object({
                        oldText: z.string().describe("The exact text to replace (must match existing lines exactly)"),
                        newText: z.string().describe("The new text to insert in place of oldText"),
                    })).describe("Array of edit operations to apply to this file"),
                })).describe("Array of files to edit. Include ALL files you need to edit in a single array."),
            }),
            execute: async ({ files }: { files: Array<{ path: string; edits: Array<{ oldText: string; newText: string }> }> }) => {
                try {
                    const tracker = getToolCallTracker();
                    const results: Array<{ path: string; success?: boolean; error?: string; editCount?: number; warning?: string }> = [];
                    
                    // Group files by path to detect duplicates and check for conflicts
                    const filesByPath = new Map<string, Array<{ index: number; edits: Array<{ oldText: string; newText: string }> }>>();
                    
                    files.forEach((file, index) => {
                        if (!filesByPath.has(file.path)) {
                            filesByPath.set(file.path, []);
                        }
                        filesByPath.get(file.path)!.push({ index, edits: file.edits });
                    });
                    
                    // Check for conflicts: if same file appears multiple times, check if oldText overlaps
                    const pathsWithConflicts = new Set<string>();
                    for (const [path, occurrences] of filesByPath.entries()) {
                        if (occurrences.length > 1) {
                            // Get all oldText strings for this path
                            const allOldTexts = occurrences.flatMap(occ => occ.edits.map(e => e.oldText));
                            
                            // Check for overlapping oldText
                            for (let i = 0; i < allOldTexts.length; i++) {
                                for (let j = i + 1; j < allOldTexts.length; j++) {
                                    const text1 = allOldTexts[i];
                                    const text2 = allOldTexts[j];
                                    // Check if one contains the other
                                    if (text1.includes(text2) || text2.includes(text1)) {
                                        pathsWithConflicts.add(path);
                                        break;
                                    }
                                }
                                if (pathsWithConflicts.has(path)) break;
                            }
                        }
                    }
                    
                    const processedPaths = new Set<string>();
                    
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const occurrences = filesByPath.get(file.path) || [];
                        const isFirstOccurrence = !processedPaths.has(file.path);
                        const hasConflict = pathsWithConflicts.has(file.path);
                        
                        // If this path has conflicts, only process the last occurrence and warn on first
                        if (occurrences.length > 1 && hasConflict) {
                            const isLastOccurrence = i === occurrences[occurrences.length - 1].index;
                            
                            if (isFirstOccurrence) {
                                results.push({
                                    path: file.path,
                                    success: false,
                                    warning: `Skipped: ${file.path} appears ${occurrences.length} times with conflicting edits. Only processing the last occurrence.`
                                });
                                processedPaths.add(file.path);
                                if (!isLastOccurrence) continue;
                            } else if (!isLastOccurrence) {
                                continue; // Skip middle duplicates silently
                            }
                        } else if (occurrences.length > 1 && !hasConflict && isFirstOccurrence) {
                            // Multiple occurrences but no conflicts - we can merge them
                            processedPaths.add(file.path);
                            
                            // Collect all edits for this path
                            const allEdits = occurrences.flatMap(occ => files[occ.index].edits);
                            
                            const writeCheck = tracker.recordWrite(file.path);
                            if (writeCheck.shouldStop) {
                                results.push({ path: file.path, success: false, error: writeCheck.message });
                                continue;
                            }
                            
                            try {
                                const result = await mcpClient.callTool({
                                    name: "edit_file",
                                    arguments: { 
                                        path: file.path, 
                                        edits: allEdits.map(edit => ({
                                            oldText: edit.oldText,
                                            newText: edit.newText,
                                        }))
                                    },
                                });
                                
                                const fileResult: any = { 
                                    path: file.path, 
                                    success: true, 
                                    editCount: allEdits.length,
                                };
                                
                                if (writeCheck.shouldWarn && writeCheck.message) {
                                    fileResult.warning = writeCheck.message;
                                }
                                
                                results.push(fileResult);
                            } catch (error) {
                                results.push({ 
                                    path: file.path, 
                                    success: false,
                                    error: `Error editing: ${error instanceof Error ? error.message : "Unknown error"}` 
                                });
                            }
                            continue;
                        } else if (processedPaths.has(file.path)) {
                            // Already processed (either merged or last occurrence)
                            continue;
                        }
                        
                        // Normal processing for single occurrence or last occurrence of conflict
                        processedPaths.add(file.path);
                        const writeCheck = tracker.recordWrite(file.path);
                        if (writeCheck.shouldStop) {
                            results.push({ path: file.path, success: false, error: writeCheck.message });
                            continue;
                        }
                        
                        try {
                            const result = await mcpClient.callTool({
                                name: "edit_file",
                                arguments: { 
                                    path: file.path, 
                                    edits: file.edits.map(edit => ({
                                        oldText: edit.oldText,
                                        newText: edit.newText,
                                    }))
                                },
                            });
                            
                            let message = "";
                            if (Array.isArray(result.content) && result.content.length > 0) {
                                const firstContent = result.content[0];
                                if (firstContent && 'text' in firstContent) {
                                    message = firstContent.text || "";
                                }
                            }
                            
                            const fileResult: any = { 
                                path: file.path, 
                                success: true, 
                                editCount: file.edits.length,
                            };
                            
                            // Add tracker warnings if any
                            if (writeCheck.shouldWarn && writeCheck.message) {
                                fileResult.warning = writeCheck.message;
                            }
                            
                            results.push(fileResult);
                        } catch (error) {
                            results.push({ 
                                path: file.path, 
                                success: false,
                                error: `Error editing: ${error instanceof Error ? error.message : "Unknown error"}` 
                            });
                        }
                    }
                    
                    // Return structured data for UI to parse
                    return { _multiFileEdit: true, files: results };
                } catch (error) {
                    console.error("editFiles error:", error);
                    return `Error editing files: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        searchFiles: {
            description: "Search for files matching a pattern in the project filesystem",
            inputSchema: z.object({
                path: z.string().describe("The directory path to search in (e.g. '/template')"),
                pattern: z.string().describe("The glob pattern to match (e.g. '**/*.tsx' for all tsx files)"),
                excludePatterns: z.array(z.string()).optional().describe("Optional patterns to exclude (e.g. ['node_modules/**'])"),
            }),
            execute: async ({ path, pattern, excludePatterns }: { path: string; pattern: string; excludePatterns?: string[] }) => {
                try {
                    const result = await mcpClient.callTool({
                        name: "search_files",
                        arguments: { path, pattern, excludePatterns },
                    });
                    
                    if (Array.isArray(result.content) && result.content.length > 0) {
                        const firstContent = result.content[0];
                        if (firstContent && 'text' in firstContent) {
                            return firstContent.text || `Searched for ${pattern} in ${path}`;
                        }
                    }
                    return `Searched for ${pattern} in ${path}`;
                } catch (error) {
                    console.error("searchFiles error:", error);
                    return `Error searching files in ${path}: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        createDirectory: {
            description: "Create a new directory in the project filesystem",
            inputSchema: z.object({
                path: z.string().describe("The directory path to create (e.g. '/template/components/game')"),
            }),
            execute: async ({ path }: { path: string }) => {
                try {
                    await mcpClient.callTool({
                        name: "create_directory",
                        arguments: { path },
                    });
                    return `Created directory ${path}`;
                } catch (error) {
                    console.error("createDirectory error:", error);
                    return `Error creating directory ${path}: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        npmInstall: {
            description: "Install npm dependencies. Run this after modifying package.json or when packages need to be installed/updated.",
            inputSchema: z.object({}),
            execute: async () => {
                try {
                    const result = await mcpClient.callTool({
                        name: "npm_install",
                        arguments: {},
                    });
                    
                    if (Array.isArray(result.content) && result.content.length > 0) {
                        const firstContent = result.content[0];
                        if (firstContent && 'text' in firstContent) {
                            return firstContent.text || `npm install completed`;
                        }
                    }
                    return `npm install completed`;
                } catch (error) {
                    console.error("npmInstall error:", error);
                    return `Error running npm install: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        npmRunLint: {
            description: "Run the linter (eslint) to check for code quality issues",
            inputSchema: z.object({}),
            execute: async () => {
                try {
                    const result = await mcpClient.callTool({
                        name: "npm_run_lint",
                        arguments: {},
                    });
                    
                    if (Array.isArray(result.content) && result.content.length > 0) {
                        const firstContent = result.content[0];
                        if (firstContent && 'text' in firstContent) {
                            return firstContent.text || `Linting completed`;
                        }
                    }
                    return `Linting completed`;
                } catch (error) {
                    console.error("npmRunLint error:", error);
                    return `Error running linter: ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
        exec: {
            description: "Execute a shell command in the project directory. Use other specialized tools when available (npmInstall, npmRunLint, etc.)",
            inputSchema: z.object({
                command: z.string().describe("The command to execute"),
                cwd: z.string().optional().describe("Optional working directory for the command"),
            }),
            execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
                try {
                    const result = await mcpClient.callTool({
                        name: "exec",
                        arguments: { command, cwd },
                    });
                    
                    if (Array.isArray(result.content) && result.content.length > 0) {
                        const firstContent = result.content[0];
                        if (firstContent && 'text' in firstContent) {
                            return firstContent.text || `Executed: ${command}`;
                        }
                    }
                    return `Executed: ${command}`;
                } catch (error) {
                    console.error("exec error:", error);
                    return `Error executing command "${command}": ${error instanceof Error ? error.message : "Unknown error"}`;
                }
            },
        },
    };
}

