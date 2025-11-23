"use server";

import { freestyle } from "./freestyle";

/**
 * Server action to request a Freestyle Dev Server for a repository.
 * This starts the dev server if it's not running and returns its status.
 * 
 * Used by the FreestyleDevServer React component to maintain the dev server
 * and provide live preview URLs.
 */
export async function requestDevServer({ repoId }: { repoId: string }) {
  const {
    ephemeralUrl,
    devCommandRunning,
    installCommandRunning,
    mcpEphemeralUrl,
  } = await freestyle.requestDevServer({ repoId });

  return {
    ephemeralUrl,
    devCommandRunning,
    installCommandRunning,
    mcpEphemeralUrl,
  };
}

