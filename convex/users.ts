import { query, mutation, action, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { CONFIG } from "./config";
import { Doc } from "./_generated/dataModel";

/**
 * Helper function to check if a user is in an active Pro period.
 * Pro period is active if subscription is active or canceled but period hasn't ended yet.
 */
export function isInProPeriod(user: Doc<"users">): boolean {
    const now = Date.now();
    return (
        (user.proSubscriptionStatus === "active" ||
            user.proSubscriptionStatus === "canceled") &&
        typeof user.proCurrentPeriodEnd === "number" &&
        now <= user.proCurrentPeriodEnd
    );
}

/**
 * Helper function to get the current authenticated user from context.
 * Used internally by mutations and queries.
 */
export async function getUserFromContext(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error("Not authenticated");
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();

    if (!user) {
        console.error("Critical: User not found in getUserFromContext", { clerkId: identity.subject });
        throw new Error("An error occurred. Please refresh the page.");
    }

    return user;
}

/**
 * Sync user from Clerk
 * Create the user in our database after first login via Clerk
 * Update email/name if changed in Clerk
 * Returns the user ID
 */
export const syncUser = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();
        
        // If user changed their email or name in Clerk, update it here
        const needsUpdateFromClerk = existingUser && (
            existingUser.email !== (identity.email || existingUser.email) ||
            existingUser.name !== (identity.name || existingUser.name)
        );

        if (needsUpdateFromClerk) {
            await ctx.db.patch(existingUser._id, {
                email: identity.email || existingUser.email,
                name: identity.name || existingUser.name,
                // Default tier if not set
                tier: existingUser.tier || (existingUser.isAdmin ? "admin" : "free"),
            });
            return existingUser._id;
        } 
        else if (!existingUser) {
            const userId = await ctx.db.insert("users", {
                clerkId: identity.subject,
                email: identity.email || "",
                name: identity.name,
                tier: "free",
            });
            return userId;
        }
    },
});

/**
 * Validate and update user's OpenAI API key
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

        // Basic input validation
        if (!args.apiKey || args.apiKey.length < CONFIG.MIN_API_KEY_LENGTH || args.apiKey.length > CONFIG.MAX_API_KEY_LENGTH) {
            throw new Error("Invalid API key format");
        }
        
        // Validate the API key by calling OpenAI with a timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_VALIDATION_TIMEOUT_MS);

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
                console.error("OpenAI API key validation failed:", {
                    status: response.status,
                    statusText: response.statusText,
                    errorText,
                });
                throw new Error("Invalid API key");
            }

            // Encrypt the API key before saving
            const encryptedKey = await ctx.runAction(internal.crypto.encryptApiKey, {
                apiKey: args.apiKey,
            });

            await ctx.runMutation(internal.users.saveApiKey, {
                apiKey: encryptedKey,
            });
        } catch (error) {
            console.error("API key validation error:", error);
            throw new Error("Failed to save API key");
        }
    },
});

/**
 * Internal mutation to save API key
 */
export const saveApiKey = internalMutation({
    args: {
        apiKey: v.string(), // Encrypted API key
    },
    handler: async (ctx, args) => {
        const user = await getUserFromContext(ctx);
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
        const user = await getUserFromContext(ctx);
        await ctx.db.patch(user._id, { openaiApiKey: undefined });
    },
});

/**
 * Get user's API key status (whether they have a key, admin status, etc.)
 */
export const getApiKeyStatus = query({
    args: {},
    handler: async (ctx) => {
        try {
            const user = await getUserFromContext(ctx);

            // Admin users can use system API key
            if (user.isAdmin) {
                return {
                    hasKey: true,
                    isAdmin: true,
                    isFreeUser: false,
                    remainingMessages: null,
                };
            }

            // Regular users must provide their own key
            return {
                hasKey: !!user.openaiApiKey,
                isAdmin: false,
                isFreeUser: false,
                remainingMessages: null,
            };
        } catch {
            return null;
        }
    },
});

/**
 * Check if user needs daily message count reset and get remaining messages.
 * Free users (no API key, not admin) get 5 messages per day.
 */
export const getRemainingMessages = query({
    args: {},
    handler: async (ctx) => {
        try {
            const user = await getUserFromContext(ctx);

            const inProPeriod = isInProPeriod(user);

            // Admin, BYOK, or users in an active Pro period have no daily free-message limit
            if (user.isAdmin || user.openaiApiKey || inProPeriod) {
                return {
                    isFreeUser: false,
                    remainingMessages: null,
                    hasKey: !!user.openaiApiKey,
                    isAdmin: !!user.isAdmin,
                };
            }

            // Free user has daily limit
            const messageCount = user.dailyMessageCount || 0;      
            return {
                isFreeUser: true,
                remainingMessages: Math.max(0, CONFIG.FREE_TIER_DAILY_LIMIT - messageCount),
                hasKey: false,
                isAdmin: false,
            };
        } catch {
            return null;
        }
    },
});

/**
 * Internal query to check if a free user has remaining message quota.
 * Returns true if the user can send another message.
 */
export const canFreeUserSendMessage = internalQuery({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in canFreeUserSendMessage", { userId: args.userId });
            return false;
        }

        const currentCount = user.dailyMessageCount || 0;
        return currentCount < CONFIG.FREE_TIER_DAILY_LIMIT;
    },
});

/**
 * Internal mutation to increment user's daily message count.
 * Returns the new count.
 * Note: Caller should check canFreeUserSendMessage first to validate quota.
 */
export const incrementMessageCount = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in incrementMessageCount", { userId: args.userId });
            throw new Error("An error occurred. Please refresh the page.");
        }

        const newCount = (user.dailyMessageCount || 0) + 1;
        await ctx.db.patch(args.userId, {
            dailyMessageCount: newCount,
        });

        return newCount;
    },
});

/**
 * Internal mutation to reset all free users' daily message counts.
 * Called by cron job at midnight GMT.
 */
export const resetAllDailyMessageCounts = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        
        const allUsers = await ctx.db.query("users").collect();
        let resetCount = 0;
        for (const user of allUsers) {
            // Only reset for free users
            const isFreeUser = !user.isAdmin && !user.openaiApiKey;
            if (isFreeUser) {
                await ctx.db.patch(user._id, {
                    dailyMessageCount: 0,
                });
                resetCount++;
            }
        }

        // Reset global free usage metrics for the new day
        const globalUsage = await ctx.db
            .query("usage")
            .withIndex("by_key", (q) => q.eq("key", "global"))
            .first();
        
        if (globalUsage) {
            await ctx.db.patch(globalUsage._id, {
                freeTokensUsedToday: 0,
                freeCapReachedToday: false,
                lastFreeUsageReset: now,
            });
        } else {
            await ctx.db.insert("usage", {
                key: "global",
                freeTokensUsedToday: 0,
                freeCapReachedToday: false,
                lastFreeUsageReset: now,
            });
        }
        return resetCount;
    },
});

/**
 * Internal mutation to exhaust all free users' daily message allowance.
 * This is called when the shared free-token pool for the day is depleted.
 */
export const exhaustAllFreeDailyMessageCounts = internalMutation({
    args: {},
    handler: async (ctx) => {
        const allUsers = await ctx.db.query("users").collect();
        for (const user of allUsers) {
            const isFreeUser = !user.isAdmin && !user.openaiApiKey;
            if (isFreeUser) {
                await ctx.db.patch(user._id, {
                    dailyMessageCount: CONFIG.FREE_TIER_DAILY_LIMIT,
                });
            }
        }
    },
});

/**
 * Mark that we've notified the user about Pro to BYOK fallback this period.
 */
export const markProByokFallbackNotified = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in markProByokFallbackNotified", { userId: args.userId });
            throw new Error("An error occurred. Please refresh the page.");
        }
        await ctx.db.patch(args.userId, {
            proByokFallbackNotifiedThisPeriod: true,
        });
    },
});

/**
 * Internal mutation to renew an active Pro subscription.
 * Charges the user, extends the period, and schedules the next renewal.
 */
export const renewProSubscription = internalMutation({
    args: {
        userId: v.id("users"),
        currentEnd: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in renewProSubscription", { userId: args.userId });
            return;
        }

        const nextEnd = args.currentEnd + 30 * 24 * 60 * 60 * 1000; // ~30 days
        
        // TODO: Integrate real billing here.
        await ctx.runMutation(internal.users.chargeForProRenewal, {
            userId: args.userId,
            amountCents: 2000, // $20 in cents
        });

        await ctx.db.patch(args.userId, {
            tier: "pro",
            proSubscriptionStatus: "active",
            proCurrentPeriodEnd: nextEnd,
            proTokensUsedThisPeriod: 0,
            proByokFallbackNotifiedThisPeriod: false,
        });

        await ctx.scheduler.runAt(
            nextEnd,
            internal.users.handleSubscriptionPeriodEnd,
            { userId: args.userId },
        );
    },
});

/**
 * Internal mutation to downgrade a canceled Pro subscription to free tier.
 */
export const downgradeProToFree = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in downgradeProToFree", { userId: args.userId });
            return;
        }

        await ctx.db.patch(args.userId, {
            tier: "free",
            proSubscriptionStatus: undefined,
            proCurrentPeriodEnd: undefined,
            proTokensUsedThisPeriod: undefined,
            proByokFallbackNotifiedThisPeriod: undefined,
        });
    },
});

/**
 * Internal mutation scheduled at the end of a Pro period.
 * Routes to renewal or downgrade based on subscription status.
 */
export const handleSubscriptionPeriodEnd = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in handleSubscriptionPeriodEnd", { userId: args.userId });
            return;
        }

        const now = Date.now();
        const currentEnd = user.proCurrentPeriodEnd;

        if (!currentEnd) {
            // No period end set – nothing to do.
            return;
        }

        if (now < currentEnd) {
            // Period hasn't actually ended yet – reschedule for the correct time.
            await ctx.scheduler.runAt(
                currentEnd,
                internal.users.handleSubscriptionPeriodEnd,
                { userId: args.userId },
            );
            return;
        }

        if (user.proSubscriptionStatus === "active") {
            await ctx.runMutation(internal.users.renewProSubscription, {
                userId: args.userId,
                currentEnd,
            });
        } else if (user.proSubscriptionStatus === "canceled") {
            await ctx.runMutation(internal.users.downgradeProToFree, {
                userId: args.userId,
            });
        }
    },
});

/**
 * Internal mutation to (mock) charge user for Pro renewal.
 * TODO: Integrate real billing system.
 */
export const chargeForProRenewal = internalMutation({
    args: {
        userId: v.id("users"),
        amountCents: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in chargeForProRenewal", { userId: args.userId });
            return;
        }
    },
});

/**
 * Internal mutation to track global free-tier token usage and enforce daily cap.
 * Called after token usage is recorded for free-tier users.
 */
export const trackGlobalFreeUsage = internalMutation({
    args: {
        totalTokens: v.number(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const todayUsage = await ctx.db
            .query("usage")
            .withIndex("by_key", (q) => q.eq("key", "global"))
            .first();

        const previousTokens = todayUsage?.freeTokensUsedToday || 0;
        const newTotal = previousTokens + args.totalTokens;
        const alreadyCapped = todayUsage?.freeCapReachedToday || false;

        // If we cross the shared cap for the first time today, exhaust all
        // free users' remaining daily messages.
        if (!alreadyCapped && newTotal > CONFIG.FREE_TIER_DAILY_TOKEN_CAP) {
            await ctx.runMutation(internal.users.exhaustAllFreeDailyMessageCounts, {});
        }

        if (todayUsage) {
            await ctx.db.patch(todayUsage._id, {
                freeTokensUsedToday: newTotal,
                freeCapReachedToday: alreadyCapped || newTotal > CONFIG.FREE_TIER_DAILY_TOKEN_CAP,
            });
        } else {
            await ctx.db.insert("usage", {
                key: "global",
                freeTokensUsedToday: newTotal,
                freeCapReachedToday: newTotal > CONFIG.FREE_TIER_DAILY_TOKEN_CAP,
                lastFreeUsageReset: now,
            });
        }
    },
});

/**
 * Internal mutation to add token usage to a user's aggregate counters.
 * This is called after an AI response is generated.
 */
export const addTokenUsage = internalMutation({
    args: {
        userId: v.id("users"),
        totalTokens: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            console.error("Critical: User not found in addTokenUsage", { userId: args.userId });
            throw new Error("An error occurred. Please refresh the page.");
        }

        const inProPeriod = isInProPeriod(user);

        // Update user token counters
        const updates: Partial<Doc<"users">> = {
            totalTokensUsed: (user.totalTokensUsed || 0) + args.totalTokens,
        };

        if (inProPeriod) {
            updates.proTokensUsedThisPeriod = (user.proTokensUsedThisPeriod || 0) + args.totalTokens;
        }

        await ctx.db.patch(args.userId, updates);

        // Track global free-tier usage if applicable
        const isFreeTierUser = !user.isAdmin && !user.openaiApiKey && !inProPeriod;
        
        if (isFreeTierUser) {
            await ctx.runMutation(internal.users.trackGlobalFreeUsage, {
                totalTokens: args.totalTokens,
            });
        }
    },
});

/**
 * Start a (mock) Pro subscription for the current user.
 * TODO: Integrate real billing system.
 */
export const startProSubscription = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getUserFromContext(ctx);

        const now = Date.now();

        const inExistingCanceledPeriod =
            user.proSubscriptionStatus === "canceled" &&
            typeof user.proCurrentPeriodEnd === "number" &&
            now <= user.proCurrentPeriodEnd;

        // If the user has canceled but their Pro period has not yet ended,
        // "continuing" the subscription just flips the status back to active
        // and keeps the same currentPeriodEnd and token counters. The existing
        // scheduled renewal/cancellation task will handle the period end.
        if (inExistingCanceledPeriod) {
            await ctx.db.patch(user._id, {
                tier: "pro",
                proSubscriptionStatus: "active",
                proByokFallbackNotifiedThisPeriod: false,
            });

            return {
                status: "resumed" as const,
                currentPeriodEnd: user.proCurrentPeriodEnd!,
            };
        }

        // Otherwise start a brand new Pro period
        const periodEnd = now + 30 * 24 * 60 * 60 * 1000; // ~30 days

        // Use the same renewal logic for initial subscription
        await ctx.scheduler.runAfter(0, internal.users.renewProSubscription, {
            userId: user._id,
            currentEnd: now, // Start from now for initial subscription
        });

        return {
            status: "success" as const,
            currentPeriodEnd: periodEnd,
        };
    },
});

/**
 * Cancel the user's Pro subscription.
 * Subscription stays active until the current period end.
 */
export const cancelProSubscription = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getUserFromContext(ctx);

        const currentPeriodEnd = user.proCurrentPeriodEnd ?? Date.now();

        await ctx.db.patch(user._id, {
            proSubscriptionStatus: "canceled",
        });

        return {
            status: "success" as const,
            currentPeriodEnd,
        };
    },
});

/**
 * Returns a high-level billing/tier status for the current user.
 */
export const getBillingStatus = query({
    args: {},
    handler: async (ctx) => {
        try {
            const user = await getUserFromContext(ctx);

            const inProPeriod = isInProPeriod(user);
            const tokensUsed = user.proTokensUsedThisPeriod || 0;
            
            // Determine effective tier based on current state
            const tier = user.isAdmin
                ? "admin"
                : inProPeriod
                ? "pro"
                : user.openaiApiKey
                ? "byok"
                : "free";

            return {
                tier,
                isAdmin: !!user.isAdmin,
                pro: {
                    status: user.proSubscriptionStatus ?? null,
                    isActive: inProPeriod,
                    currentPeriodEnd: user.proCurrentPeriodEnd ?? null,
                    tokensUsedThisPeriod: tokensUsed,
                    remainingTokens: Math.max(0, CONFIG.DEFAULT_PRO_MONTHLY_TOKEN_LIMIT - tokensUsed),
                    byokFallbackNotifiedThisPeriod: user.proByokFallbackNotifiedThisPeriod ?? false,
                },
            };
        } catch {
            return null;
        }
    },
});

