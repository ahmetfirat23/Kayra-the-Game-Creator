import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUserFromContext } from "./users";

export { categorizeError } from "./categorizeError";

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
