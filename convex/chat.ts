import { query, mutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { components } from "./_generated/api";
import { saveMessage, listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
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
 * @deprecated Use listThreadMessages for streaming support.
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
 * Retrieves messages for a thread with streaming support.
 * Returns both regular messages and streaming deltas, allowing clients
 * to see messages update in real-time as they're generated.
 */
export const listThreadMessages = query({
    args: {
        chatId: v.id("chats"),
        paginationOpts: paginationOptsValidator,
        streamArgs: vStreamArgs,
    },
    handler: async (ctx, args) => {
        // Get the chat to retrieve the threadId
        const chat = await ctx.db.get(args.chatId);
        if (!chat || !chat.threadId) {
            return {
                page: [],
                isDone: true,
                continueCursor: "",
            };
        }

        // Fetch regular non-streaming messages
        const paginated = await listUIMessages(ctx, components.agent, {
            threadId: chat.threadId,
            paginationOpts: args.paginationOpts,
        });

        // Fetch streaming deltas
        const streams = await syncStreams(ctx, components.agent, {
            threadId: chat.threadId,
            streamArgs: args.streamArgs,
        });

        return { ...paginated, streams };
    },
});

/**
 * Saves a user message and triggers AI response generation.
 * The message is saved to both our database and the agent thread immediately
 * so it appears in the UI right away. Then processMessage is scheduled to
 * generate the AI response.
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

        // Get or create thread for this chat
        const chat = await ctx.db.get(args.chatId);
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
            await ctx.db.patch(args.chatId, { threadId });
        }

        // Save message to agent thread immediately so it appears in UI right away
        const { messageId } = await saveMessage(ctx, components.agent, {
            threadId,
            prompt: args.text,
        });

        // Schedule action to generate AI response
        await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
            chatId: args.chatId,
            threadId,
            promptMessageId: messageId,
        });
    },
});

/**
 * Processes a user message and generates an AI response with streaming.
 * 
 * This internal action:
 * - Uses the messageId passed from sendMessage (message already saved to thread)
 * - Streams the response using the configured AI agent with saveStreamDeltas enabled
 * - Response chunks are saved as deltas to the database, allowing clients to
 *   subscribe and see updates in real-time as the response is generated
 * 
 * The agent maintains conversation history within each thread, allowing
 * for context-aware responses across multiple messages.
 */
export const processMessage = internalAction({
    args: {
        chatId: v.id("chats"),
        threadId: v.string(),
        promptMessageId: v.string(),
    },
    handler: async (ctx, args) => {
        // Generate agent response with streaming
        // saveStreamDeltas saves chunks to the database as they're generated,
        // allowing clients to subscribe and see updates in real-time
        await myAgent.streamText(
            ctx,
            { threadId: args.threadId },
            { promptMessageId: args.promptMessageId },
            {
                saveStreamDeltas: {
                    chunking: "word",
                    throttleMs: 100,
                },
            }
        );
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
 * @deprecated No longer needed with streaming - messages are saved via deltas.
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