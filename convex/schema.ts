import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        clerkId: v.string(),
        email: v.string(),
        name: v.optional(v.string()),
        openaiApiKey: v.optional(v.string()), // User's OpenAI API key (BYOK)
        isAdmin: v.optional(v.boolean()), // Admin users can use system API key
        dailyMessageCount: v.optional(v.number()), // Number of messages sent today (for free users)
        lastMessageReset: v.optional(v.number()), // Timestamp of last daily reset (GMT midnight)
        // Aggregate token usage across all AI responses for this user
        totalTokensUsed: v.optional(v.number()),
        // Subscription / tier info
        tier: v.optional(
            v.union(
                v.literal("free"),
                v.literal("byok"),
                v.literal("pro"),
                v.literal("admin"),
            ),
        ),
        proSubscriptionStatus: v.optional(
            v.union(v.literal("active"), v.literal("canceled")),
        ),
        proCurrentPeriodEnd: v.optional(v.number()), // Timestamp when current Pro period ends
        proTokensUsedThisPeriod: v.optional(v.number()), // Tokens used in current Pro period
        proMonthlyTokenLimit: v.optional(v.number()), // Allowance per period (e.g. 25M)
        // Whether we've already notified the user that Pro fell back to BYOK this period
        proByokFallbackNotifiedThisPeriod: v.optional(v.boolean()),
    }).index("by_clerk_id", ["clerkId"]),
    
    chats: defineTable({
        userId: v.id("users"), // Link chat to user
        name: v.string(),
        createdAt: v.number(),
        threadId: v.optional(v.string()),
        repoId: v.optional(v.string()), // Freestyle Git repository ID
        isAiTurn: v.optional(v.boolean()), // True when AI is thinking/responding
    }).index("by_user", ["userId"]),
    
    messages: defineTable({
        chatId: v.id("chats"),
        text: v.string(),
        sender: v.union(v.literal("user"), v.literal("assistant")),
        // Total tokens (prompt + completion) used for the AI response that
        // produced this message. Only set for assistant messages.
        totalTokens: v.optional(v.number()),
    }).index("by_chat", ["chatId"]),
    
    usage: defineTable({
        key: v.string(), // e.g. "global"
        freeTokensUsedToday: v.optional(v.number()),
        freeCapReachedToday: v.optional(v.boolean()),
        lastFreeUsageReset: v.optional(v.number()),
    }).index("by_key", ["key"]),
});