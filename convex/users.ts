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
        
        if (!identity) {
            return null;
        }

        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (existingUser) {
            // Update existing user
            await ctx.db.patch(existingUser._id, {
                email: identity.email || existingUser.email,
                name: identity.name || existingUser.name,
                // Default tier if not set
                tier: existingUser.tier || (existingUser.isAdmin ? "admin" : "free"),
            });
            return existingUser._id;
        } else {
            // Create new user
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
 * This is an action because it needs to make an HTTP request to OpenAI and use Node.js crypto
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

            // Encrypt the API key before saving
            const encryptedKey = await ctx.runAction(internal.crypto.encryptApiKey, {
                apiKey: args.apiKey,
            });

            // Key is valid and encrypted, save it via internal mutation
            await ctx.runMutation(internal.users.saveApiKey, {
                clerkId: identity.subject,
                apiKey: encryptedKey, // Save encrypted version
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
 * Internal mutation to save API key (called after validation and encryption)
 */
export const saveApiKey = internalMutation({
    args: {
        clerkId: v.string(),
        apiKey: v.string(), // This is already encrypted by the action
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        // Save the encrypted key directly (already encrypted by action)
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
    },
});

/**
 * Check if user needs daily message count reset and get remaining messages.
 * Free users (no API key, not admin) get 5 messages per day.
 */
export const getRemainingMessages = query({
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

        const now = Date.now();
        const inProPeriod =
            (user.proSubscriptionStatus === "active" ||
                user.proSubscriptionStatus === "canceled") &&
            typeof user.proCurrentPeriodEnd === "number" &&
            now <= user.proCurrentPeriodEnd;

        // Admin, BYOK, or users in an active Pro period have no daily free-message limit
        if (user.isAdmin || user.openaiApiKey || inProPeriod) {
            return {
                isFreeUser: false,
                remainingMessages: null,
                hasKey: !!user.openaiApiKey,
                isAdmin: !!user.isAdmin,
            };
        }

        // Free user - check daily limit
        const FREE_DAILY_LIMIT = 5;
        const lastReset = user.lastMessageReset || 0;
        
        // Check if we need to reset (midnight GMT)
        const todayMidnightGMT = new Date(now);
        todayMidnightGMT.setUTCHours(0, 0, 0, 0);
        const lastResetDate = new Date(lastReset);
        lastResetDate.setUTCHours(0, 0, 0, 0);
        
        const needsReset = todayMidnightGMT.getTime() > lastResetDate.getTime();
        const messageCount = needsReset ? 0 : (user.dailyMessageCount || 0);
        
        return {
            isFreeUser: true,
            remainingMessages: Math.max(0, FREE_DAILY_LIMIT - messageCount),
            hasKey: false,
            isAdmin: false,
            totalDailyLimit: FREE_DAILY_LIMIT,
        };
    },
});

/**
 * Internal mutation to reset daily message count for a user.
 */
export const resetDailyMessageCount = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.userId, {
            dailyMessageCount: 0,
            lastMessageReset: Date.now(),
        });
    },
});

/**
 * Internal mutation to increment user's daily message count.
 * Returns the new count.
 */
export const incrementMessageCount = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        const FREE_DAILY_LIMIT = 5;
        const now = Date.now();
        const lastReset = user.lastMessageReset || 0;
        
        // Check if we need to reset (midnight GMT)
        const todayMidnightGMT = new Date(now);
        todayMidnightGMT.setUTCHours(0, 0, 0, 0);
        const lastResetDate = new Date(lastReset);
        lastResetDate.setUTCHours(0, 0, 0, 0);
        
        const needsReset = todayMidnightGMT.getTime() > lastResetDate.getTime();
        
        let newCount: number;
        if (needsReset) {
            newCount = 1;
            await ctx.db.patch(args.userId, {
                dailyMessageCount: 1,
                lastMessageReset: now,
            });
        } else {
            newCount = (user.dailyMessageCount || 0) + 1;
            await ctx.db.patch(args.userId, {
                dailyMessageCount: newCount,
            });
        }

        // Check if user exceeded limit
        if (newCount > FREE_DAILY_LIMIT) {
            throw new Error(`Daily message limit exceeded. Free users get ${FREE_DAILY_LIMIT} messages per day. Please add your own OpenAI API key to continue.`);
        }

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
        
        // Get all users who are free users (no API key, not admin)
        const allUsers = await ctx.db.query("users").collect();
        
        let resetCount = 0;
        for (const user of allUsers) {
            // Only reset for free users (no API key, not admin)
            const isFreeUser = !user.isAdmin && !user.openaiApiKey;
            if (isFreeUser && (user.dailyMessageCount || 0) > 0) {
                await ctx.db.patch(user._id, {
                    dailyMessageCount: 0,
                    lastMessageReset: now,
                });
                resetCount++;
            }
        }

        // Also reset global free usage metrics for the new day
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
        const now = Date.now();
        const FREE_DAILY_LIMIT = 5;

        const allUsers = await ctx.db.query("users").collect();

        let updatedCount = 0;
        for (const user of allUsers) {
            const isFreeUser = !user.isAdmin && !user.openaiApiKey;
            if (isFreeUser) {
                await ctx.db.patch(user._id, {
                    dailyMessageCount: FREE_DAILY_LIMIT,
                    lastMessageReset: now,
                });
                updatedCount++;
            }
        }
        return updatedCount;
    },
});

/**
 * Mark that we've notified the user about Pro → BYOK fallback this period.
 */
export const markProByokFallbackNotified = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            return;
        }

        if (!user.proByokFallbackNotifiedThisPeriod) {
            await ctx.db.patch(args.userId, {
                proByokFallbackNotifiedThisPeriod: true,
            });
        }
    },
});

/**
 * Internal mutation to downgrade any users whose Pro period has ended.
 * This is called from a daily cron job rather than scheduling per-user jobs.
 */
export const downgradeExpiredProUsers = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const allUsers = await ctx.db.query("users").collect();

        let downgraded = 0;
        for (const user of allUsers) {
            const inProPeriod =
                (user.proSubscriptionStatus === "active" ||
                    user.proSubscriptionStatus === "canceled") &&
                typeof user.proCurrentPeriodEnd === "number" &&
                now <= user.proCurrentPeriodEnd;

            // If user is non-admin, subscription is canceled, and the Pro period has ended,
            // downgrade them back to the free tier.
            if (
                !user.isAdmin &&
                user.proSubscriptionStatus === "canceled" &&
                !inProPeriod &&
                typeof user.proCurrentPeriodEnd === "number"
            ) {
                await ctx.db.patch(user._id, {
                    tier: "free",
                    proSubscriptionStatus: undefined,
                    proCurrentPeriodEnd: undefined,
                    proTokensUsedThisPeriod: undefined,
                    proMonthlyTokenLimit: undefined,
                });
                downgraded++;
            }
        }
        return downgraded;
    },
});

/**
 * Internal mutation scheduled at the end of a Pro period.
 *
 * - If the subscription is still "active" at that time, it renews:
 *   - advances the period end by another 30 days
 *   - resets the period token counter
 *   - schedules the next period-end task
 * - If the subscription was "canceled", it downgrades the user to the free tier.
 */
export const handleSubscriptionPeriodEnd = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            return;
        }

        const now = Date.now();
        const currentEnd = user.proCurrentPeriodEnd;

        if (!currentEnd || now < currentEnd) {
            // Period hasn't actually ended yet (or no period) – nothing to do.
            return;
        }

        if (user.proSubscriptionStatus === "active") {
            // Auto-renew: extend by another 30 days from the previous end,
            // reset the per-period token counter, and schedule the next period end.
            const nextEnd = currentEnd + 30 * 24 * 60 * 60 * 1000;

            // Mock payment step for renewal – this is where a real billing
            // integration would be called. Currently it is a no-op that
            // just records that a renewal "payment" was attempted.
            await ctx.runMutation(internal.users.chargeForProRenewal, {
                userId: args.userId,
                amountCents: 2000, // $20 in cents
            });

            await ctx.db.patch(args.userId, {
                tier: user.isAdmin ? "admin" : "pro",
                proSubscriptionStatus: "active",
                proCurrentPeriodEnd: nextEnd,
                proTokensUsedThisPeriod: 0,
                proMonthlyTokenLimit: user.proMonthlyTokenLimit ?? 7_000_000,
                proByokFallbackNotifiedThisPeriod: false,
            });

            await ctx.scheduler.runAt(
                nextEnd,
                internal.users.handleSubscriptionPeriodEnd,
                { userId: args.userId },
            );
        } else if (user.proSubscriptionStatus === "canceled") {
            // End of a canceled period: fully downgrade to free.
            await ctx.db.patch(args.userId, {
                tier: "free",
                proSubscriptionStatus: undefined,
                proCurrentPeriodEnd: undefined,
                proTokensUsedThisPeriod: undefined,
                proMonthlyTokenLimit: undefined,
                proByokFallbackNotifiedThisPeriod: undefined,
            });
        }
    },
});

/**
 * Internal no-op "payment" mutation for Pro renewals.
 *
 * This is the integration point where a real billing provider
 * (Stripe, Lemon Squeezy, etc.) would be called. For now it
 * only logs the attempt so we can wire up billing later without
 * changing the subscription flow.
 */
export const chargeForProRenewal = internalMutation({
    args: {
        userId: v.id("users"),
        amountCents: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            return;
        }
        // TODO add real billing integration here later.
    },
});

/**
 * Internal mutation to add token usage to a user aggregate.
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
            throw new Error("User not found");
        }

        const now = Date.now();
        const updates: Record<string, unknown> = {};

        // Global token aggregate
        const currentTotal = user.totalTokensUsed || 0;
        updates.totalTokensUsed = currentTotal + args.totalTokens;

        // Pro-period accounting (if applicable).
        // Pro remains active until the end of the period even if canceled.
        const inProPeriod =
            user.tier === "pro" &&
            (user.proSubscriptionStatus === "active" ||
                user.proSubscriptionStatus === "canceled") &&
            typeof user.proCurrentPeriodEnd === "number" &&
            now <= user.proCurrentPeriodEnd;

        const monthlyLimit = user.proMonthlyTokenLimit ?? 7_000_000;

        if (inProPeriod) {
            const tokensUsed = (user.proTokensUsedThisPeriod || 0) + args.totalTokens;
            updates.proTokensUsedThisPeriod = tokensUsed;
            updates.proMonthlyTokenLimit = monthlyLimit;
        }

        // Persist per-user aggregates
        await ctx.db.patch(args.userId, updates);

        // Track global free-tier usage and enforce a shared daily cap.
        const isFreeTierUser =
            !user.isAdmin &&
            !user.openaiApiKey &&
            !inProPeriod;

        if (isFreeTierUser) {
            const todayUsage = await ctx.db
                .query("usage")
                .withIndex("by_key", (q) => q.eq("key", "global"))
                .first();

            const previousTokens = todayUsage?.freeTokensUsedToday || 0;
            const newTotal = previousTokens + args.totalTokens;
            const alreadyCapped = todayUsage?.freeCapReachedToday || false;
            const CAP = 1_000_000;

            // If we cross the shared cap for the first time today, exhaust all
            // free users' remaining daily messages.
            if (!alreadyCapped && newTotal > CAP) {
                await ctx.runMutation(internal.users.exhaustAllFreeDailyMessageCounts, {});
            }

            if (todayUsage) {
                await ctx.db.patch(todayUsage._id, {
                    freeTokensUsedToday: newTotal,
                    freeCapReachedToday: alreadyCapped || newTotal > CAP,
                });
            } else {
                await ctx.db.insert("usage", {
                    key: "global",
                    freeTokensUsedToday: newTotal,
                    freeCapReachedToday: newTotal > CAP,
                    lastFreeUsageReset: now,
                });
            }
        }
    },
});

/**
 * Start a (mock) Pro subscription for the current user.
 * No real payment is processed; this simply marks the user as Pro.
 */
export const startProSubscription = mutation({
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

        const now = Date.now();
        const monthlyLimit = user.proMonthlyTokenLimit ?? 7_000_000;

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
                tier: user.isAdmin ? "admin" : "pro",
                proSubscriptionStatus: "active",
                proByokFallbackNotifiedThisPeriod: false,
            });

            return {
                status: "resumed" as const,
                currentPeriodEnd: user.proCurrentPeriodEnd!,
                monthlyLimit,
            };
        }

        // Otherwise start a brand new Pro period and schedule its end.
        const periodEnd = now + 30 * 24 * 60 * 60 * 1000; // ~30 days

        await ctx.db.patch(user._id, {
            tier: user.isAdmin ? "admin" : "pro",
            proSubscriptionStatus: "active",
            proCurrentPeriodEnd: periodEnd,
            proTokensUsedThisPeriod: 0,
            proMonthlyTokenLimit: monthlyLimit,
        });

        await ctx.scheduler.runAt(
            periodEnd,
            internal.users.handleSubscriptionPeriodEnd,
            { userId: user._id },
        );

        return {
            status: "success" as const,
            currentPeriodEnd: periodEnd,
            monthlyLimit,
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

        const now = Date.now();
        const inProPeriod =
            (user.proSubscriptionStatus === "active" ||
                user.proSubscriptionStatus === "canceled") &&
            typeof user.proCurrentPeriodEnd === "number" &&
            now <= user.proCurrentPeriodEnd;

        const baseTier = user.isAdmin ? "admin" : user.tier || "free";
        const tier =
            baseTier === "admin"
                ? "admin"
                : inProPeriod
                ? "pro"
                : user.openaiApiKey
                ? "byok"
                : "free";

        const monthlyLimit = user.proMonthlyTokenLimit ?? 7_000_000;
        const used = user.proTokensUsedThisPeriod || 0;

        return {
            tier,
            isAdmin: !!user.isAdmin,
            pro: {
                status: user.proSubscriptionStatus ?? null,
                isActive: inProPeriod,
                currentPeriodEnd: user.proCurrentPeriodEnd ?? null,
                tokensUsedThisPeriod: used,
                monthlyLimit,
                remainingTokens: Math.max(0, monthlyLimit - used),
                byokFallbackNotifiedThisPeriod:
                    user.proByokFallbackNotifiedThisPeriod ?? false,
            },
        };
    },
});

