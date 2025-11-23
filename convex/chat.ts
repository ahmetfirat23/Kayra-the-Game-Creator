import { query, mutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { components } from "./_generated/api";
import { saveMessage } from "@convex-dev/agent";
import { myAgent } from "./agent";

export const listChats = query({
    args: {},
    handler: async (ctx) => {
        const chats = await ctx.db.query("chats").order("desc").collect();
        return chats;
    },
});

export const createChat = mutation({
    args: {},
    handler: async (ctx) => {
        const chatId = await ctx.db.insert("chats", {
            name: `Chat ${Date.now()}`,
            createdAt: Date.now(),
        });
        return chatId;
    },
});

export const getMessages = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .order("desc")
            .collect();
        return messages.reverse();
    },
});

export const sendMessage = mutation({
    args: {
        chatId: v.id("chats"),
        text: v.string(),
    },
    handler: async(ctx, args) => {
        // Save user message to our database
        await ctx.db.insert("messages", {
            chatId: args.chatId,
            text: args.text,
            sender: "user",
        });

        // Schedule action to handle agent thread and response
        await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
            chatId: args.chatId,
            text: args.text,
        });
    },
});

export const processMessage = internalAction({
    args: {
        chatId: v.id("chats"),
        text: v.string(),
    },
    handler: async (ctx, args) => {
        // Get chat to check for threadId
        const chat = await ctx.runQuery(api.chat.getChat, { chatId: args.chatId });
        if (!chat) {
            throw new Error("Chat not found");
        }

        let threadId = chat.threadId;
        
        // Create thread if it doesn't exist
        if (!threadId) {
            const thread = await ctx.runMutation(components.agent.threads.createThread, {
                title: chat.name || "Chat Conversation",
            });
            threadId = thread._id;
            await ctx.runMutation(api.chat.updateChatThreadId, {
                chatId: args.chatId,
                threadId,
            });
        }

        // Save message to agent thread and get messageId
        const { messageId } = await saveMessage(ctx, components.agent, {
            threadId,
            prompt: args.text,
        });

        // Generate agent response
        await myAgent.generateText(ctx, { threadId }, { promptMessageId: messageId });

        // Get the messages from the thread to extract the response
        const threadMessagesResult = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
            threadId,
            order: "desc",
        });

        // Extract the text response from the last assistant message
        let responseText = "";
        const allMessages = threadMessagesResult.page;
        const lastAssistantMessage = allMessages.find((msg) => {
            if (msg.message && typeof msg.message === "object" && "role" in msg.message) {
                return msg.message.role === "assistant";
            }
            return false;
        });

        if (lastAssistantMessage?.message && typeof lastAssistantMessage.message === "object" && "content" in lastAssistantMessage.message) {
            const content = lastAssistantMessage.message.content;
            if (typeof content === "string") {
                responseText = content;
            } else if (Array.isArray(content)) {
                responseText = content
                    .filter((part): part is { type: "text"; text: string } => part.type === "text")
                    .map((part) => part.text)
                    .join("");
            }
        }

        // Save agent response to database
        await ctx.runMutation(api.chat.saveAgentResponse, {
            chatId: args.chatId,
            text: responseText || "I'm sorry, I couldn't generate a response.",
        });
    },
});

export const getChat = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.chatId);
    },
});

export const updateChatThreadId = mutation({
    args: {
        chatId: v.id("chats"),
        threadId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.chatId, { threadId: args.threadId });
    },
});


export const saveAgentResponse = mutation({
    args: {
        chatId: v.id("chats"),
        text: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("messages", {
            chatId: args.chatId,
            text: args.text,
            sender: "assistant",
        });
    },
});