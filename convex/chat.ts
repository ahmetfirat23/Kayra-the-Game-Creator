import { query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { CONFIG } from "./config";
import { components } from "./_generated/api";
import { saveMessage, listMessages, syncStreams, toUIMessages, vStreamArgs } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { authenticateAndVerifyChatOwnership, aggregateUsageByOrder, categorizeError } from "./ChatHelper";
import { resolveApiKey } from "./ApiKeyResolver";
import { createTurnBasedContextHandler } from "./ContextHandler";
import { getUserFromContext, isInProPeriod } from "./users";

/**
 * Returns all chats for the current user, ordered by creation date descending.
 */
export const listChats = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
            console.error("listChats: User not found for identity", identity);
            return [];
        }

        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .order("desc")
            .collect();
        return chats;
    },
});

/**
 * Creates a new chat for the current user. T
 * The actual Freestyle repo creation happens in a separate action.
 */
export const createChat = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getUserFromContext(ctx);

        // Rate limiting: Prevent spam by checking recent chat creations
        const rateLimitWindowAgo = Date.now() - CONFIG.RATE_LIMIT_WINDOW_MS;
        const recentChats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .filter((q) => q.gt(q.field("createdAt"), rateLimitWindowAgo))
            .collect();

        if (recentChats.length >= CONFIG.MAX_CHATS_PER_MINUTE) {
            throw new Error("Too many chats created. Please wait a moment before creating another.");
        }

        const chatId = await ctx.db.insert("chats", {
            userId: user._id,
            name: `3D Game ${Date.now()}`, // TODO: Use AI summary for name
            createdAt: Date.now(),
            repoId: "pending", // Placeholder until repo is created
        });
        
        // Schedule action to create the Freestyle repo
        await ctx.scheduler.runAfter(0, internal.chat.createAndAttachRepo, {
            chatId,
        });
        
        return chatId;
    },
});

/**
 * Internal action to create a Freestyle Git repository and attach it to the chat. Uses Freestyle's Expo template as the base.
 */
export const createAndAttachRepo = internalAction({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        // Import freestyle client dynamically to avoid issues
        const { freestyle } = await import("../lib/freestyle");
        
        const { repoId } = await freestyle.createGitRepository({
            name: `3D Game ${Date.now()}`,
            public: false,
            source: {
                url: "https://github.com/freestyle-sh/freestyle-expo",
            },
            devServers: {
                preset: "expo", // Use Expo preset for dev server configuration
            },
        });

        // Wait a moment for the repo to be ready
        await new Promise(resolve => setTimeout(resolve, CONFIG.REPO_CREATION_WAIT_MS));

        try {
            // Request dev server to ensure it's running
            const devServer = await freestyle.requestDevServer({ repoId });
            
            // Install React Three Fiber dependencies using MCP
            const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
            const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
            
            const mcpClient = new Client(
                { name: "setup", version: "1.0.0" },
                { capabilities: {} }
            );
            
            await mcpClient.connect(new StreamableHTTPClientTransport(new URL(devServer.mcpEphemeralUrl)));
            
            try {
                // Install R3F and dependencies
                await mcpClient.callTool({
                    name: "exec",
                    arguments: { command: "cd /template && npm install three @react-three/fiber @react-three/drei @react-three/rapier zustand @use-gesture/react" },
                });
                await mcpClient.callTool({
                    name: "exec",
                    arguments: { command: "cd /template && npx expo install expo-gl expo-av expo-haptics" },
                });
                // Use exec for git commit to avoid syntax checking on the initial template files
                // The template uses path aliases (@/...) that Babel can't resolve during the check
                await mcpClient.callTool({
                    name: "exec",
                    arguments: { command: "cd /template && git add -A && git commit -m 'Initial setup: Installed React Three Fiber dependencies' && git push" },
                });
            } finally {
                await mcpClient.close();
            }
        } catch (error) {
            console.error("Error during initial repo setup:", error);
            // Continue anyway - agent can install later if needed
        }
        
        // Update the chat with the repoId
        await ctx.runMutation(internal.chat.updateChatWithRepo, {
            chatId: args.chatId,
            repoId,
        });
        
        return { repoId };
    },
});

/**
 * Internal mutation to update a chat with its repository ID.
 */
export const updateChatWithRepo = internalMutation({
    args: {
        chatId: v.id("chats"),
        repoId: v.string(),
    },
    handler: async (ctx, args) => {
        const chat = await ctx.db.get(args.chatId);
        if (!chat) {
            console.log(`Chat ${args.chatId} was deleted before repo creation completed`);
            return;
        }
        await ctx.db.patch(args.chatId, { repoId: args.repoId });
    },
});

/**
 * Retrieves messages for a thread with streaming support.
 * Returns both regular messages and streaming deltas, allowing clients
 * to see messages update in real-time as they're generated.
 */
export const listThreadMessages = query({
    args: {
        threadId: v.string(),
        paginationOpts: paginationOptsValidator,
        streamArgs: vStreamArgs,
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const chat = await ctx.db
            .query("chats")
            .filter((q) => q.eq(q.field("threadId"), args.threadId))
            .first();
        
        if (!chat) {
            throw new Error("Chat not found for this thread");
        }
        authenticateAndVerifyChatOwnership(ctx, chat._id);

        // Fetch underlying MessageDocs so we can access usage/metadata
        const paginatedDocs = await listMessages(ctx, components.agent, {
            threadId: args.threadId,
            paginationOpts: args.paginationOpts,
        });
        type DocType = typeof paginatedDocs.page[0];
        const usageByOrder = aggregateUsageByOrder(paginatedDocs.page);


        
        // Attach aggregated usage to metadata so it survives conversion to UIMessage
        // We attach to the FIRST message per order since toUIMessages uses group.find()
        const attachedOrders = new Set<number>();
        const docsWithMetadata = paginatedDocs.page.map((doc) => {
            const order = (doc as { order?: number }).order ?? 0;
            const isFirstOfOrder = !attachedOrders.has(order);
            if (isFirstOfOrder) {
                attachedOrders.add(order);
            }
            const aggregatedUsage = isFirstOfOrder ? usageByOrder.get(order) : undefined;
            
            return {
                ...doc,
                metadata: aggregatedUsage ? { usage: aggregatedUsage } : undefined,
            };
        });
        // Convert to UIMessage objects for the React client
        const page = toUIMessages(docsWithMetadata as DocType[]);

        // Fetch streaming deltas
        const streams = await syncStreams(ctx, components.agent, {
            threadId: args.threadId,
            streamArgs: args.streamArgs,
        });

        return { ...paginatedDocs, page, streams };
    },
});

/**
 * Saves a user message and triggers AI response generation.
 * The message is saved to both our database and the agent thread.
 */
export const sendMessage = mutation({
    args: {
        chatId: v.id("chats"),
        text: v.string(),
    },
    handler: async(ctx, args) => {
        const { user, chat } = await authenticateAndVerifyChatOwnership(ctx, args.chatId);

        if (!args.text.trim()) {
            throw new Error("Message cannot be empty");
        }
        if (args.text.length > CONFIG.MAX_MESSAGE_LENGTH) {
            throw new Error(`Message too long (max ${CONFIG.MAX_MESSAGE_LENGTH} characters)`);
        }

        // Rate limiting: Prevent message spam
        const rateLimitWindowAgo = Date.now() - CONFIG.RATE_LIMIT_WINDOW_MS;
        const recentMessages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .filter((q) => q.and(
                q.gt(q.field("_creationTime"), rateLimitWindowAgo),
                q.eq(q.field("sender"), "user")
            ))
            .collect();

        if (recentMessages.length >= CONFIG.MAX_MESSAGES_PER_MINUTE) {
            throw new Error("Too many messages. Please wait a moment before sending another.");
        }

        if (!chat.repoId || chat.repoId === "pending") {
            throw new Error("Repository is still being created. Please wait a moment and try again.");
        }

        const inProPeriod = isInProPeriod(user);
        const isFreeUser = !user.isAdmin && !inProPeriod && !user.openaiApiKey ;
        
        if (isFreeUser) {
            const canSend = await ctx.runQuery(internal.users.canFreeUserSendMessage, { userId: user._id, });
            if (!canSend) {
                throw new Error(`Daily message limit exceeded. Free users get ${CONFIG.FREE_TIER_DAILY_LIMIT} messages per day.`);
            }
            
            await ctx.runMutation(internal.users.incrementMessageCount, {
                userId: user._id,
            });
        }

        // Save user message to our database
        await ctx.db.insert("messages", {
            chatId: args.chatId,
            text: args.text,
            sender: "user",
        });

        let threadId = chat.threadId;
        // Create thread if it doesn't exist
        if (!threadId) {
            const thread = await ctx.runMutation(components.agent.threads.createThread, {
                title: chat.name,
            });
            threadId = thread._id;
            await ctx.db.patch(args.chatId, { threadId });
        }

        // Save message to agent thread immediately
        const { messageId } = await saveMessage(ctx, components.agent, {
            threadId,
            prompt: args.text,
        });
        await ctx.db.patch(args.chatId, { isAiTurn: true });

        // Schedule action to generate AI response
        await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
            chatId: args.chatId,
            threadId,
            promptMessageId: messageId,
            repoId: chat.repoId,
            userId: chat.userId!,
        });
    },
});

/**
 * Get user by ID (for API key lookup)
 */
export const getUser = internalQuery({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.userId);
    },
});

/**
 * Calculate total tokens used in the current AI response
 */
async function calculateTokenUsage(ctx: any, threadId: string): Promise<number> {
    const allMessages = await listMessages(ctx, components.agent, {
        threadId,
        paginationOpts: { numItems: 100, cursor: null },
    });
    
    // Find the current response's order (highest order in the thread)
    const maxOrder = Math.max(...allMessages.page.map(m => (m as { order?: number }).order ?? 0));
    
    let totalTokens = 0;
    for (const msg of allMessages.page) {
        const msgOrder = (msg as { order?: number }).order ?? 0;
        if (msgOrder === maxOrder) {
            const msgUsage = msg.usage as { totalTokens?: number } | undefined;
            totalTokens += msgUsage?.totalTokens ?? 0;
        }
    }
    
    return totalTokens;
}

/**
 * Auto-commits uncommitted changes and returns the updated text with commit message
 */
async function autoCommitIfNeeded(
    mcpClient: any,
    tracker: any,
    finalText: string
): Promise<{ text: string; committed: boolean }> {
    if (!tracker.hasUncommittedChanges()) {
        return { text: finalText, committed: false };
    }

    try {
        const commitResult = await mcpClient.callTool({
            name: "git_commit_and_push",
            arguments: { message: "Auto-commit: Changes made by AI" },
        });
        
        let commitMessage = "Changes committed automatically";
        if (Array.isArray(commitResult.content) && commitResult.content.length > 0) {
            const firstContent = commitResult.content[0];
            if (firstContent && 'text' in firstContent) {
                const commitOutput = firstContent.text || "";
                if (commitOutput) {
                    commitMessage = `${commitOutput}`;
                }
            }
        }
        
        const textToSave = finalText ? `${finalText}\n\n${commitMessage}` : commitMessage;
        return { text: textToSave, committed: true };
    } catch (commitError) {
        console.error("Auto-commit error:", commitError);
        return { text: finalText, committed: false };
    }
}

/**
 * Processes a user message and generates an AI response with streaming.
 */
export const processMessage = internalAction({
    args: {
        chatId: v.id("chats"),
        threadId: v.string(),
        promptMessageId: v.string(),
        repoId: v.string(),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        try {
            const user = await ctx.runQuery(internal.chat.getUser, { userId: args.userId });
            if (!user) {
                throw new Error("User not found");
            }
            const apiKey = await resolveApiKey(ctx, user);

            // Import dependencies
            const { createAgent, createFreestyleTools, resetToolCallTracker, getToolCallTracker } = await import("./agent");
            const { stepCountIs } = await import("@convex-dev/agent");
            const { freestyle } = await import("../lib/freestyle");
            const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
            const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");

            resetToolCallTracker();

            // Connect to MCP server once
            const devServer = await freestyle.requestDevServer({ repoId: args.repoId });
            const mcpClient = new Client(
                { name: "game-builder", version: "1.0.0" },
                { capabilities: {} }
            );
            await mcpClient.connect(new StreamableHTTPClientTransport(new URL(devServer.mcpEphemeralUrl)));

            const freestyleTools = createFreestyleTools(mcpClient);
            const agent = createAgent(apiKey);
            const contextHandler = createTurnBasedContextHandler();

            // Use the agent's streamText WITH our custom Freestyle tools
            const result = await agent.streamText(
                ctx,
                { threadId: args.threadId },
                {
                    promptMessageId: args.promptMessageId,
                    tools: freestyleTools,
                    stopWhen: stepCountIs(CONFIG.MAX_AGENT_STEPS),
                },
                {
                    saveStreamDeltas: {
                        chunking: "word",
                        throttleMs: CONFIG.STREAM_THROTTLE_MS,
                    },
                    contextHandler,
                }
            );

            const finalText = await result.text;
            
            const tracker = getToolCallTracker();
            const { text: textToSave } = await autoCommitIfNeeded(mcpClient, tracker, finalText);
            
            await mcpClient.close();

            const totalTokens = await calculateTokenUsage(ctx, args.threadId);

            if (textToSave) {
                await ctx.runMutation(internal.chat.saveAgentResponse, {
                    chatId: args.chatId,
                    text: textToSave,
                    totalTokens,
                });
            }

            if (totalTokens > 0) {
                await ctx.runMutation(internal.users.addTokenUsage, {
                    userId: args.userId,
                    totalTokens,
                });
            }

            await ctx.runMutation(internal.chat.setAiTurn, {
                chatId: args.chatId,
                isAiTurn: false,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const { userMessage, shouldRethrow } = categorizeError(errorMessage);
            
            if (userMessage) {
                await ctx.runMutation(internal.chat.saveAgentResponse, {
                    chatId: args.chatId,
                    text: userMessage,
                    totalTokens: 0,
                });
            }
            
            await ctx.runMutation(internal.chat.setAiTurn, {
                chatId: args.chatId,
                isAiTurn: false,
            });
            
            // Don't re-throw handled errors
            if (!shouldRethrow) {
                return;
            }
            // Re-throw unhandled errors
            throw error;
        }
    },
});


/**
 * Retrieves a single chat by its ID.
 */
export const getChat = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        try{
            const { chat } = await authenticateAndVerifyChatOwnership(ctx, args.chatId);
            return chat;
        } catch (error) {
            return null;
        }
    },
});

/**
 * Updates a chat with its associated agent thread ID.
 */
export const updateChatThreadId = mutation({
    args: {
        chatId: v.id("chats"),
        threadId: v.string(),
    },
    handler: async (ctx, args) => {
        await authenticateAndVerifyChatOwnership(ctx, args.chatId);
        await ctx.db.patch(args.chatId, { threadId: args.threadId });
    },
});

/**
 * Saves the AI assistant's response to the messages table.
 */
export const saveAgentResponse = internalMutation({
    args: {
        chatId: v.id("chats"),
        text: v.string(),
        totalTokens: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("messages", {
            chatId: args.chatId,
            text: args.text,
            sender: "assistant",
            totalTokens: args.totalTokens,
        });
    },
});

/**
 * Set AI turn flag for a chat (internal use only)
 */
export const setAiTurn = internalMutation({
    args: {
        chatId: v.id("chats"),
        isAiTurn: v.boolean(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.chatId, { isAiTurn: args.isAiTurn });
    },
});

/**
 * Delete a chat and all its messages
 */
export const deleteChat = mutation({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const { user , chat } = await authenticateAndVerifyChatOwnership(ctx, args.chatId);

        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .collect();

        for (const message of messages) {
            await ctx.db.delete(message._id);
        }

        // Delete the agent thread and all its messages if it exists
        if (chat.threadId) {
            await ctx.scheduler.runAfter(0, internal.chat.deleteThread, {
                threadId: chat.threadId,
            });
        }

        // Delete the Freestyle repository if it exists
        if (chat.repoId && chat.repoId !== "pending") {
            await ctx.scheduler.runAfter(0, internal.chat.deleteRepo, {
                repoId: chat.repoId,
            });
        }

        // Delete the chat
        await ctx.db.delete(args.chatId);
    },
});

/**
 * Internal action to delete a thread and all its associated data
 */
export const deleteThread = internalAction({
    args: {
        threadId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.runAction(components.agent.threads.deleteAllForThreadIdSync, {
            threadId: args.threadId,
        });
    },
});

/**
 * Internal action to delete a Freestyle repository
 */
export const deleteRepo = internalAction({
    args: {
        repoId: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            const { freestyle } = await import("../lib/freestyle");
            await freestyle.deleteGitRepository({ repoId: args.repoId });
            console.log(`Deleted Freestyle repo: ${args.repoId}`);
        } catch (error) {
            console.error(`Failed to delete Freestyle repo ${args.repoId}:`, error);
            // Don't throw - we still want the chat to be deleted even if repo deletion fails
        }
    },
});