import type { ContextHandler } from "@convex-dev/agent";
import { CONFIG } from "./config";

/**
 * Custom context handler that limits context window
 * - The initial user request
 * - Recent complete turns, including their tool responses
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
        
        const targetRecentTurns = CONFIG.RECENT_MESSAGES_COUNT;
        const recentTurns = turns.slice(-targetRecentTurns);
        const recentMessages = recentTurns.length > 0
            ? recent.slice(recentTurns[0].startIndex, recentTurns[recentTurns.length - 1].endIndex + 1)
            : [];
        const firstUser = turns.find((turn) => turn.type === "user" &&
            (recentTurns.length === 0 || turn.endIndex < recentTurns[0].startIndex));
        const anchor = firstUser ? [recent[firstUser.startIndex]] : [];
        const result = [...anchor, ...recentMessages, ...inputPrompt];
        console.log(`CONTEXT WINDOW: ${anchor.length} initial request, ${recentMessages.length} recent messages, ${inputPrompt.length} prompt messages`);
        return result;
    };
};
