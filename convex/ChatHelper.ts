import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUserFromContext } from "./users";

/**
 * Authenticates user and verifies chat ownership
 */
export async function authenticateAndVerifyChatOwnership(
    ctx: QueryCtx | MutationCtx,
    chatId: Id<"chats">
): Promise<{ user: Doc<"users">; chat: Doc<"chats"> }> {
    const user = await getUserFromContext(ctx);
    const chat = await ctx.db.get(chatId);
    if (!chat) {
        throw new Error("Chat not found");
    }
    if (chat.userId !== user._id) {
        throw new Error("Not authorized to access this chat");
    }
    return { user, chat };
}

/**
 * Aggregates token usage from messages with the same order
 */
export function aggregateUsageByOrder(
    messages: Array<{ order?: number; 
                    usage?: { cachedInputTokens?: number; completionTokens?: number; promptTokens?: number; reasoningTokens?: number; totalTokens?: number } }>): 
    Map<number, 
        { cachedInputTokens?: number; completionTokens?: number; promptTokens?: number; reasoningTokens?: number; totalTokens?: number }> 
    {
    type UsageType = { cachedInputTokens?: number; completionTokens?: number; promptTokens?: number; reasoningTokens?: number; totalTokens?: number };
    const usageByOrder = new Map<number, UsageType>();
    
    for (const doc of messages) {
        const order = doc.order ?? 0;
        const docUsage = doc.usage as UsageType | undefined;
        if (docUsage) {
            const existing = usageByOrder.get(order) || { cachedInputTokens: 0, completionTokens: 0, promptTokens: 0, reasoningTokens: 0, totalTokens: 0 };
            usageByOrder.set(order, {
                cachedInputTokens: (existing.cachedInputTokens || 0) + (docUsage.cachedInputTokens || 0),
                completionTokens: (existing.completionTokens || 0) + (docUsage.completionTokens || 0),
                promptTokens: (existing.promptTokens || 0) + (docUsage.promptTokens || 0),
                reasoningTokens: (existing.reasoningTokens || 0) + (docUsage.reasoningTokens || 0),
                totalTokens: (existing.totalTokens || 0) + (docUsage.totalTokens || 0),
            });
        }
    }
    
    return usageByOrder;
}

/**
 * Categorizes error types for user-friendly messages
 */
export function categorizeError(errorMessage: string): {
    userMessage: string;
    shouldRethrow: boolean;
} {
    const isToolOutputError = errorMessage.includes("No tool output found for function call");
    const isToolCallError = errorMessage.includes("tool call") || 
        errorMessage.includes("Tool call") ||
        errorMessage.includes("function call") ||
        errorMessage.includes("Invalid tool");
    const isToolExecutionError = errorMessage.includes("Error calling tool") ||
        errorMessage.includes("Tool execution failed") ||
        errorMessage.includes("callTool");
    const isToolValidationError = errorMessage.includes("Invalid tool arguments") ||
        errorMessage.includes("schema") ||
        errorMessage.includes("validation");
    const isStreamInterrupted = errorMessage.includes("stream") && (
        errorMessage.includes("interrupted") || 
        errorMessage.includes("closed") ||
        errorMessage.includes("aborted")
    );
    const isMcpTimeout = errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT");
    const isConnectionError = errorMessage.includes("ECONNREFUSED") || 
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("network");
    
    if (isToolOutputError || isToolCallError || isToolExecutionError) {
        return {
            userMessage: "Connection interrupted: The AI's response was interrupted while executing an action. This can happen due to temporary connection issues. Please try sending your message again, or check the current state of your game to see what was completed.",
            shouldRethrow: false,
        };
    }
    
    if (isToolValidationError) {
        return {
            userMessage: "Tool validation error: The AI tried to use a tool incorrectly. Please try rephrasing your request or try again.",
            shouldRethrow: false,
        };
    }
    
    if (isStreamInterrupted) {
        return {
            userMessage: "Stream interrupted: The response was interrupted unexpectedly. Please try again.",
            shouldRethrow: false,
        };
    }
    
    if (isMcpTimeout) {
        return {
            userMessage: "Request timed out: The operation took too long to complete. This might happen with complex changes. Please try a simpler request or try again.",
            shouldRethrow: false,
        };
    }
    
    if (isConnectionError) {
        return {
            userMessage: "Connection error: Lost connection to the development server. Please try again in a moment.",
            shouldRethrow: false,
        };
    }
    
    return { userMessage: "", shouldRethrow: true };
}
