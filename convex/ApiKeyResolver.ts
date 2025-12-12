import { ActionCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { CONFIG } from "./config";
import { isInProPeriod } from "./users"

/**
 * Determines which API key to use based on user subscription status
 * Priority:
 * 1. Admin users: use system key
 * 2. Active Pro period: use Pro key while under cap; if cap exhausted and BYOK exists, use BYOK
 * 3. Users with their own key (BYOK): use their key
 * 4. Free users (no key, not admin): use system key with daily limit
 */
export async function resolveApiKey(
    ctx: ActionCtx,
    user: Doc<"users">
): Promise<string> {
    let apiKey: string | undefined;
    let useByok = false;
    const inProPeriod = isInProPeriod(user);
    const proKey = process.env.PRO_OPENAI_API_KEY;

    if (user.isAdmin) {
        apiKey = process.env.OPENAI_API_KEY;
    } else if (inProPeriod) {
        const used = user.proTokensUsedThisPeriod || 0;
        if (proKey && used < CONFIG.DEFAULT_PRO_MONTHLY_TOKEN_LIMIT) {
            apiKey = proKey;
        } else if (used >= CONFIG.DEFAULT_PRO_MONTHLY_TOKEN_LIMIT && user.openaiApiKey) {
            useByok = true;
            if (!user.proByokFallbackNotifiedThisPeriod) {
                await ctx.runMutation(internal.users.markProByokFallbackNotified, {
                    userId: user._id,
                });
            }
        } else if (!proKey) {
            throw new Error(
                "Pro key is not configured for this app. Please contact the owner or switch to BYOK.",
            );
        } else {
            throw new Error(
                "Pro token allowance exceeded for this period. Your subscription will renew next month.",
            );
        }
    } else if (user.openaiApiKey) {
        useByok = true;
    } else {
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

    return apiKey;
}
