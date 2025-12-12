import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Reset daily message counts for all free users at midnight GMT.
 */
crons.daily(
  "reset daily message counts",
  { hourUTC: 0, minuteUTC: 0 }, // Midnight GMT
  internal.users.resetAllDailyMessageCounts
);

export default crons;
