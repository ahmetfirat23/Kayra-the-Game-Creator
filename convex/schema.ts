import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        clerkId: v.string(), // Clerk user ID
        email: v.string(), // User email from Clerk
        name: v.optional(v.string()), // User name from Clerk
        openaiApiKey: v.optional(v.string()), // User's OpenAI API key
        isAdmin: v.optional(v.boolean()), // Admin user flag
        dailyMessageCount: v.optional(v.number()), // Number of messages sent today (resets daily for free users)
        totalTokensUsed: v.optional(v.number()), // Aggregate token usage across all AI responses for this user
        tier: v.optional(
            v.union(
                v.literal("free"),
                v.literal("byok"),
                v.literal("pro"),
                v.literal("admin"),
            ),
        ), // Subscription / tier info
        proSubscriptionStatus: v.optional(
            v.union(v.literal("active"), v.literal("canceled")),
        ), // Pro subscription status
        proCurrentPeriodEnd: v.optional(v.number()), // Timestamp when current Pro period ends
        proTokensUsedThisPeriod: v.optional(v.number()), // Tokens used in current Pro period
        proByokFallbackNotifiedThisPeriod: v.optional(v.boolean()), // Whether we've already notified the user that Pro fell back to BYOK this period
        lastApiKeyUpdate: v.optional(v.number()), // Timestamp of last API key update attempt
        apiKeyUpdateAttempts: v.optional(v.number()), // Number of API key updates in current rate limit window
    }).index("by_clerk_id", ["clerkId"]),
    
    chats: defineTable({
        userId: v.id("users"), // Link chat to user
        name: v.string(), // Chat name
        createdAt: v.number(), // Timestamp when chat was created
        threadId: v.optional(v.string()), // ID of associated agent thread
        repoId: v.optional(v.string()), // Freestyle Git repository ID
        isAiTurn: v.optional(v.boolean()), // True when AI is thinking/responding
    }).index("by_user", ["userId"]),
    
    messages: defineTable({
        chatId: v.id("chats"), // Link message to chat
        text: v.string(), // Message text content
        sender: v.union(v.literal("user"), v.literal("assistant")), // Who sent the message
        totalTokens: v.optional(v.number()), // Total tokens used in this message (for assistant messages)
    }).index("by_chat", ["chatId"]),
    
    usage: defineTable({
        key: v.string(), // "global"
        freeTokensUsedToday: v.optional(v.number()), // Total free tokens used today across all users
        freeCapReachedToday: v.optional(v.boolean()), // Whether the free cap was reached today
        lastFreeUsageReset: v.optional(v.number()), // Timestamp of last free usage reset
    }).index("by_key", ["key"]),
});