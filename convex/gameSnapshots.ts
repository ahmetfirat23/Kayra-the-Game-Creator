import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authenticateAndVerifyChatOwnership } from "./ChatHelper";

const file = v.object({ path: v.string(), content: v.string() });

export const get = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    await authenticateAndVerifyChatOwnership(ctx, chatId);
    const row = await ctx.db.query("gameSnapshots").withIndex("by_chat", q => q.eq("chatId", chatId)).first();
    return row ? { files: row.files } : null;
  },
});

export const save = internalMutation({
  args: { chatId: v.id("chats"), files: v.array(file) },
  handler: async (ctx, { chatId, files }) => {
    if (!await ctx.db.get(chatId)) throw new Error("Chat not found");
    const row = await ctx.db.query("gameSnapshots").withIndex("by_chat", q => q.eq("chatId", chatId)).first();
    if (row) await ctx.db.patch(row._id, { files, updatedAt: Date.now() });
    else await ctx.db.insert("gameSnapshots", { chatId, files, updatedAt: Date.now() });
  },
});
