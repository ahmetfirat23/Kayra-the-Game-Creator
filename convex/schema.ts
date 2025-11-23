import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        clerkId: v.string(),
        email: v.string(),
        name: v.optional(v.string()),
        openaiApiKey: v.optional(v.string()), // User's OpenAI API key (BYOK)
        isAdmin: v.optional(v.boolean()), // Admin users can use system API key
    }).index("by_clerk_id", ["clerkId"]),
    
    chats: defineTable({
        userId: v.id("users"), // Link chat to user
        name: v.string(),
        createdAt: v.number(),
        threadId: v.optional(v.string()),
        repoId: v.optional(v.string()), // Freestyle Git repository ID
    }).index("by_user", ["userId"]),
    
    messages: defineTable({
        chatId: v.id("chats"),
        text: v.string(),
        sender: v.union(v.literal("user"), v.literal("assistant")),
    }).index("by_chat", ["chatId"]),
});