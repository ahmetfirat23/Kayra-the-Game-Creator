import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Reset daily message counts for all free users at midnight GMT.
 * This ensures free users get their 5 messages refreshed each day.
 */
crons.daily(
  "reset daily message counts",
  { hourUTC: 0, minuteUTC: 0 }, // Midnight GMT
  internal.users.resetAllDailyMessageCounts
);

// Subscription renewal and cancellation are handled via per-user scheduled
// tasks (see users.handleSubscriptionPeriodEnd) created when Pro is started
// or resumed, so we don't need a global daily downgrade job here.

export default crons;
