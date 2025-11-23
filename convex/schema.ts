import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    chats: defineTable({
        name: v.string(),
        createdAt: v.number(),
        threadId: v.optional(v.string()),
        repoId: v.optional(v.string()), // Freestyle Git repository ID
    }),
    messages: defineTable({
        chatId: v.id("chats"),
        text: v.string(),
        sender: v.union(v.literal("user"), v.literal("assistant")),
        previewUrl: v.optional(v.string()),
    }).index("by_chat", ["chatId"]),
});