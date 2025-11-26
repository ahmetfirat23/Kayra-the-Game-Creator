import { query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";
import { saveMessage, listMessages, syncStreams, toUIMessages, vStreamArgs } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";

/**
 * Returns all chats for the current user, ordered by creation date (newest first).
 */
export const listChats = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        // Get user from database
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
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
 * Creates a new chat for the current user. The actual Freestyle repo creation happens in a separate action.
 * @returns The chatId
 */
export const createChat = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Get or create user
        let user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
            // Create user if they don't exist yet
            const userId = await ctx.db.insert("users", {
                clerkId: identity.subject,
                email: identity.email || "",
                name: identity.name,
            });
            user = await ctx.db.get(userId);
            if (!user) {
                throw new Error("Failed to create user");
            }
        }

        const chatId = await ctx.db.insert("chats", {
            userId: user._id,
            name: `3D Game ${Date.now()}`,
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
 * Internal action to create a Freestyle Git repository and attach it to the chat.
 * Uses Freestyle's Expo template as the base.
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
            public: true, // Make repo publicly accessible for easy cloning/testing
            source: {
                url: "https://github.com/freestyle-sh/freestyle-expo",
            },
            devServers: {
                preset: "expo", // Use Expo preset for dev server configuration
            },
        });
        
        console.log(`Created repo ${repoId}, installing React Three Fiber dependencies...`);

        // Wait a moment for the repo to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));

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
                console.log("Installing three, @react-three/fiber, and @react-three/drei...");
                await mcpClient.callTool({
                    name: "exec",
                    arguments: { command: "npm install three @react-three/fiber @react-three/drei" },
                });
                
                console.log("Installing expo-gl...");
                await mcpClient.callTool({
                    name: "exec",
                    arguments: { command: "npx expo install expo-gl" },
                });
                
                console.log("Committing dependency changes...");
                await mcpClient.callTool({
                    name: "git_commit_and_push",
                    arguments: { message: "Initial setup: Installed React Three Fiber dependencies" },
                });
                
                console.log("✅ React Three Fiber dependencies installed successfully!");
            } finally {
                await mcpClient.close();
            }
        } catch (error) {
            console.error("Error installing dependencies:", error);
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
        await ctx.db.patch(args.chatId, { repoId: args.repoId });
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
        threadId: v.string(),
        paginationOpts: paginationOptsValidator,
        streamArgs: vStreamArgs,
    },
    handler: async (ctx, args) => {
        // Fetch underlying MessageDocs so we can access usage/metadata
        const paginatedDocs = await listMessages(ctx, components.agent, {
            threadId: args.threadId,
            paginationOpts: args.paginationOpts,
        });

        // Attach usage to metadata so it survives conversion to UIMessage
        const docsWithMetadata = paginatedDocs.page.map((doc) => {
            const existingMetadata = (doc as { metadata?: unknown }).metadata;
            return {
                ...doc,
                metadata: {
                    ...(typeof existingMetadata === "object" && existingMetadata !== null
                        ? existingMetadata
                        : {}),
                    usage: doc.usage,
                },
            };
        });

        // Convert to UIMessage objects for the React client
        const page = toUIMessages(docsWithMetadata);

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
        // Get the chat and user
        const chat = await ctx.db.get(args.chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        const user = await ctx.db.get(chat.userId);
        if (!user) {
            throw new Error("User not found");
        }

        const now = Date.now();
        const inProPeriod =
            (user.proSubscriptionStatus === "active" ||
                user.proSubscriptionStatus === "canceled") &&
            typeof user.proCurrentPeriodEnd === "number" &&
            now <= user.proCurrentPeriodEnd;

        // Check if user is free user (no API key, not admin, no active Pro period)
        const isFreeUser = !user.isAdmin && !user.openaiApiKey && !inProPeriod;
        
        // For free users, check and increment message count
        if (isFreeUser) {
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

        if (!chat.repoId || chat.repoId === "pending") {
            throw new Error("Repository is still being created. Please wait a moment and try again.");
        }

        let threadId = chat.threadId;
        
        // Create thread if it doesn't exist
        if (!threadId) {
            const thread = await ctx.runMutation(components.agent.threads.createThread, {
                title: chat.name || "3D Game Chat",
            });
            threadId = thread._id;
            await ctx.db.patch(args.chatId, { threadId });
        }

        // Save message to agent thread immediately so it appears in UI right away
        const { messageId } = await saveMessage(ctx, components.agent, {
            threadId,
            prompt: args.text,
        });

        // Mark chat as AI's turn (prevents user from sending more messages)
        await ctx.db.patch(args.chatId, { isAiTurn: true });

        // Schedule action to generate AI response with Freestyle repo access
        await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
            chatId: args.chatId,
            threadId,
            promptMessageId: messageId,
            repoId: chat.repoId, // Pass repoId for dev server access
            userId: chat.userId!, // Pass userId for API key lookup
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
        repoId: v.string(),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        try {
            // Get user's API key
            const user = await ctx.runQuery(internal.chat.getUser, { userId: args.userId });
            if (!user) {
                throw new Error("User not found");
            }

            // Determine which API key to use:
            // Priority:
            // 1. Admin users: use system key
            // 2. Active Pro period: use Pro key while under cap; if cap exhausted and BYOK exists, use BYOK
            // 3. Users with their own key (BYOK): use their key
            // 4. Free users (no key, not admin): use system key with daily limit
            let apiKey: string | undefined;
            let useByok = false;
            const now = Date.now();
            const inProPeriod =
                (user.proSubscriptionStatus === "active" ||
                    user.proSubscriptionStatus === "canceled") &&
                typeof user.proCurrentPeriodEnd === "number" &&
                now <= user.proCurrentPeriodEnd;
            const proKey = process.env.PRO_OPENAI_API_KEY;

            if (user.isAdmin) {
                apiKey = process.env.OPENAI_API_KEY;
            } else if (inProPeriod) {
                const monthlyLimit = user.proMonthlyTokenLimit ?? 7_000_000;
                const used = user.proTokensUsedThisPeriod || 0;

                if (proKey && used < monthlyLimit) {
                    // Normal Pro usage under cap → use Pro key
                    apiKey = proKey;
                } else if (used >= monthlyLimit && user.openaiApiKey) {
                    // Pro cap exhausted, but user has BYOK → allow BYOK instead of system key
                    useByok = true;
                    // Mark that we fell back to BYOK this period (for user notification).
                    await ctx.runMutation(internal.users.markProByokFallbackNotified, {
                        userId: args.userId,
                    });
                } else if (!proKey) {
                    // Pro subscription exists but Pro key is not configured – fail loudly instead
                    // of silently using the system key.
                    throw new Error(
                        "Pro key is not configured for this app. Please contact the owner or switch to BYOK.",
                    );
                } else {
                    // Cap exhausted and no BYOK → do NOT fall back to system key
                    throw new Error(
                        "Pro token allowance exceeded for this period. Your subscription will renew next month.",
                    );
                }
            } else if (user.openaiApiKey) {
                // BYOK outside of Pro period
                useByok = true;
            } else {
                // Free user - use admin key (message count already checked in sendMessage)
                apiKey = process.env.OPENAI_API_KEY;
            }

            if (useByok) {
                apiKey = await ctx.runAction(internal.crypto.decryptApiKey, {
                    encryptedData: user.openaiApiKey!,
                });
            }
            
            if (!apiKey) {
                throw new Error("No API key configured. Please contact support.");
            }

            // Import dependencies
            const { createAgent, createFreestyleTools } = await import("./agent");
            const { stepCountIs } = await import("@convex-dev/agent");
            const { freestyle } = await import("../lib/freestyle");
            const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
            const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");

            // Connect to MCP server once
            const devServer = await freestyle.requestDevServer({ repoId: args.repoId });
            const mcpClient = new Client(
                { name: "game-builder", version: "1.0.0" },
                { capabilities: {} }
            );
            await mcpClient.connect(new StreamableHTTPClientTransport(new URL(devServer.mcpEphemeralUrl)));

            // Create Freestyle tools that use the MCP client
            const freestyleTools = createFreestyleTools(mcpClient);
            
            console.log(`✅ Created ${Object.keys(freestyleTools).length} Freestyle tools`);

            // Create agent with user's API key
            const agent = createAgent(apiKey);

            // Use the agent's streamText WITH our custom Freestyle tools
            const result = await agent.streamText(
                ctx,
                { threadId: args.threadId },
                {
                    promptMessageId: args.promptMessageId,
                    tools: freestyleTools,
                    stopWhen: stepCountIs(15),
                },
                {
                    saveStreamDeltas: {
                        chunking: "word",
                        throttleMs: 100,
                    },
                }
            );

            // Get the final text and token usage
            const finalText = await result.text;
            const usage = await result.usage;
            const totalTokens = usage?.totalTokens ?? 0;

            // Close MCP connection
            await mcpClient.close();

            // Save the final response text and token usage to the messages table
            if (finalText) {
                await ctx.runMutation(internal.chat.saveAgentResponse, {
                    chatId: args.chatId,
                    text: finalText,
                    totalTokens,
                });
            }

            // Aggregate token usage on the user record
            if (totalTokens > 0) {
                await ctx.runMutation(internal.users.addTokenUsage, {
                    userId: args.userId,
                    totalTokens,
                });
            }

            // Mark chat as user's turn (allows user to send messages again)
            await ctx.runMutation(internal.chat.setAiTurn, {
                chatId: args.chatId,
                isAiTurn: false,
            });
        } catch (error) {
            console.error("Error processing message:", error);
            
            // Ensure AI turn is reset even on error
            await ctx.runMutation(internal.chat.setAiTurn, {
                chatId: args.chatId,
                isAiTurn: false,
            });
            
            // Re-throw the error
            throw error;
        }
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
 * Gets a chat ID from a thread ID.
 * Used by tools to associate files with chats.
 */
export const getChatByThreadId = internalQuery({
    args: {
        threadId: v.string(),
    },
    handler: async (ctx, args) => {
        const chat = await ctx.db
            .query("chats")
            .filter((q) => q.eq(q.field("threadId"), args.threadId))
            .first();
        return chat?._id;
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
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Get the chat
        const chat = await ctx.db.get(args.chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        // Get user to verify ownership
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        // Verify user owns this chat
        if (chat.userId !== user._id) {
            throw new Error("Not authorized to delete this chat");
        }

        // Delete all messages in this chat
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .collect();

        for (const message of messages) {
            await ctx.db.delete(message._id);
        }

        // Delete the chat
        await ctx.db.delete(args.chatId);
    },
});