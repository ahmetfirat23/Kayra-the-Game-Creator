import { query, mutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { components } from "./_generated/api";
import { saveMessage } from "@convex-dev/agent";
import { myAgent } from "./agent";

/**
 * Returns all chats ordered by creation date (newest first).
 */
export const listChats = query({
    args: {},
    handler: async (ctx) => {
        const chats = await ctx.db.query("chats").order("desc").collect();
        return chats;
    },
});

/**
 * Creates a new chat with an auto-generated name based on timestamp.
 * @returns The ID of the newly created chat.
 */
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

/**
 * Retrieves all messages for a specific chat in chronological order.
 * Uses the 'by_chat' index for efficient querying.
 */
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

/**
 * Saves a user message and triggers AI response generation.
 * The message is immediately saved to the database, then processMessage
 * is scheduled to run asynchronously to generate the AI response.
 */
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

/**
 * Processes a user message and generates an AI response.
 * 
 * This internal action:
 * - Gets or creates an agent thread for the chat (one thread per chat)
 * - Saves the message to the agent thread for conversation context
 * - Generates a response using the configured AI agent
 * - Extracts the response text and saves it to the database
 * 
 * The agent maintains conversation history within each thread, allowing
 * for context-aware responses across multiple messages.
 */
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

/**
 * Retrieves a single chat by its ID.
 * Used internally to check chat existence and access threadId.
 */
export const getChat = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.chatId);
    },
});

/**
 * Updates a chat with its associated agent thread ID.
 * This links the chat to the Convex Agent thread system, allowing
 * the agent to maintain conversation context for this chat.
 */
export const updateChatThreadId = mutation({
    args: {
        chatId: v.id("chats"),
        threadId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.chatId, { threadId: args.threadId });
    },
});

/**
 * Saves the AI assistant's response to the messages table.
 * Called after the agent generates a response to store it
 * alongside user messages in the chat.
 */
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