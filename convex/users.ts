import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Get or create user from Clerk ID
 */
export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        return user;
    },
});

/**
 * Sync user from Clerk (called on login/page load)
 */
export const syncUser = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        console.log("Identity:", JSON.stringify(identity, null, 2));
        
        if (!identity) {
            console.log("No identity found");
            return null;
        }

        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (existingUser) {
            console.log("Updating existing user:", existingUser._id);
            // Update existing user
            await ctx.db.patch(existingUser._id, {
                email: identity.email || existingUser.email,
                name: identity.name || existingUser.name,
            });
            return existingUser._id;
        } else {
            console.log("Creating new user for:", identity.subject);
            // Create new user
            const userId = await ctx.db.insert("users", {
                clerkId: identity.subject,
                email: identity.email || "",
                name: identity.name,
            });
            console.log("Created user:", userId);
            return userId;
        }
    },
});

/**
 * Validate and update user's OpenAI API key
 * This is an action because it needs to make an HTTP request to OpenAI
 */
export const updateApiKey = action({
    args: {
        apiKey: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Validate the API key by calling OpenAI with a timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch("https://api.openai.com/v1/models", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${args.apiKey}`,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = "Invalid API key";
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error?.message || errorMessage;
                } catch {
                    // If parsing fails, use default message
                }
                
                throw new Error(errorMessage);
            }

            // Key is valid, save it via internal mutation
            await ctx.runMutation(internal.users.saveApiKey, {
                clerkId: identity.subject,
                apiKey: args.apiKey,
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === "AbortError") {
                    throw new Error("Validation timed out. Please check your internet connection and try again.");
                }
                throw new Error(error.message);
            }
            throw new Error("Failed to validate API key. Please check your key and try again.");
        }
    },
});

/**
 * Internal mutation to save API key (called after validation)
 */
export const saveApiKey = internalMutation({
    args: {
        clerkId: v.string(),
        apiKey: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        await ctx.db.patch(user._id, {
            openaiApiKey: args.apiKey,
        });
    },
});

/**
 * Deletes the current user's OpenAI API key.
 */
export const deleteApiKey = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        await ctx.db.patch(user._id, { openaiApiKey: undefined });
    },
});

/**
 * Get user's API key (or fallback to system key for admin)
 */
export const getApiKey = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
            return null;
        }

        // Admin users can use system API key
        if (user.isAdmin) {
            return {
                hasKey: true,
                isAdmin: true,
            };
        }

        // Regular users must provide their own key
        return {
            hasKey: !!user.openaiApiKey,
            isAdmin: false,
        };
    },
});

