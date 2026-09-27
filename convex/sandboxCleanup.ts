"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { CLEANUP_DELAY_MS } from "../lib/sandbox-viewers";

export const cleanupIdleSandbox = internalAction({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    const state = await ctx.runQuery(internal.chat.getSandboxCleanupState, { chatId });
    if (!state || state.activeViewers) return;
    if (state.aiTurn) {
      await ctx.runMutation(internal.chat.scheduleSandboxCleanup, { chatId, delayMs: CLEANUP_DELAY_MS });
      return;
    }
    // Check again immediately before stopping the VM; another tab may have
    // registered while this action was waiting for a network call.
    const current = await ctx.runQuery(internal.chat.getSandboxCleanupState, { chatId });
    if (!current || current.activeViewers || current.aiTurn || current.token !== state.token) return;
    if (!current.appOrigin) return;
    try {
      const response = await fetch(`${current.appOrigin}/api/sandbox/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, token: state.token }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Sandbox cleanup returned ${response.status}`);
    } catch (error) {
      console.error("Sandbox cleanup failed", error);
      await ctx.runMutation(internal.chat.scheduleSandboxCleanup, { chatId, delayMs: CLEANUP_DELAY_MS });
    }
  },
});
