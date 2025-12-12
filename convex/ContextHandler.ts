import type { ContextHandler } from "@convex-dev/agent";
import { CONFIG } from "./config";

/**
 * Custom context handler that limits context window
 * - All messages until first tool call (planning phase)
 * - Plus recent turns for ongoing work
 */
export const createTurnBasedContextHandler = (): ContextHandler => {
    return async (_ctx, handlerArgs) => {
        const { recent, inputPrompt } = handlerArgs;
        
        // Group messages into turns
        const turns: Array<{ startIndex: number; endIndex: number; type: "user" | "assistant" }> = [];
        let i = 0;
        while (i < recent.length) {
            const msg = recent[i];
            if (msg.role === "user") {
                turns.push({ startIndex: i, endIndex: i, type: "user" });
                i++;
            } else if (msg.role === "assistant") {
                const turnStart = i;
                let turnEnd = i;
                for (let j = i + 1; j < recent.length; j++) {
                    if (recent[j].role === "tool") {
                        turnEnd = j;
                    } else {
                        break;
                    }
                }
                turns.push({ startIndex: turnStart, endIndex: turnEnd, type: "assistant" });
                i = turnEnd + 1;
            } else {
                i++;
            }
        }
        
        // Find the first turn that contains a tool call (marks end of planning phase)
        let firstToolCallTurnIndex = -1;
        for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
            const turn = turns[turnIdx];
            if (turn.type === "assistant") {
                const msg = recent[turn.startIndex];
                if (msg.content && hasToolCall(msg.content)) {
                    firstToolCallTurnIndex = turnIdx;
                    break;
                }
            }
        }
        
        // If no tool call found yet, include all messages (planning phase)
        if (firstToolCallTurnIndex === -1) {
            const result = [...recent, ...inputPrompt];
            console.log("###########\nCONTEXT WINDOW (planning phase):");
            console.log(`  Total turns: ${turns.length}`);
            console.log(`  Total messages: ${result.length}`);
            return result;
        }
        
        // Include all turns up to and including the first tool call turn (planning phase)
        const planningPhaseTurns = turns.slice(0, firstToolCallTurnIndex + 1);
        const planningPhaseEndIndex = planningPhaseTurns[planningPhaseTurns.length - 1].endIndex;
        const planningPhase = recent.slice(0, planningPhaseEndIndex + 1);
        
        // Get the most recent N turns
        const remainingTurns = turns.slice(firstToolCallTurnIndex + 1);
        const targetRecentTurns = CONFIG.RECENT_MESSAGES_COUNT;
        const recentTurns = remainingTurns.slice(-targetRecentTurns);
        
        const recentMessages = recentTurns.length > 0
            ? recent.slice(recentTurns[0].startIndex, recentTurns[recentTurns.length - 1].endIndex + 1)
            : [];
        
        // Combine: planning phase + recent turns + current prompt
        const result = [...planningPhase, ...recentMessages, ...inputPrompt];
        
        console.log("###########\nCONTEXT WINDOW (turn-based limiting):");
        console.log(`  Total turns in history: ${turns.length}`);
        console.log(`  Planning phase: ${planningPhaseTurns.length} turns (${planningPhase.length} messages)`);
        console.log(`  Recent context: ${recentTurns.length} turns (${recentMessages.length} messages)`);
        console.log(`  Input prompt: ${inputPrompt.length} messages`);
        console.log(`  Total context: ${result.length} messages from ${planningPhaseTurns.length + recentTurns.length} turns`);
        
        return result;
    };
};

function hasToolCall(content: unknown): boolean {
    if (Array.isArray(content)) {
        return content.some((part: unknown) => {
            if (typeof part === "object" && part !== null) {
                const p = part as Record<string, unknown>;
                return p.type === "tool_use" || 
                       p.type === "tool-call" || 
                       p.type === "tool_call" ||
                       "toolCallId" in p ||
                       "toolName" in p;
            }
            return false;
        });
    }
    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    return contentStr.includes('"type":"tool') || 
           contentStr.includes('"toolCallId"') || 
           contentStr.includes('"toolName"');
}
