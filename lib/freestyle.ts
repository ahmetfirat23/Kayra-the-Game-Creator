import { FreestyleSandboxes } from "freestyle-sandboxes";

if (!process.env.FREESTYLE_API_KEY) {
  throw new Error(
    "FREESTYLE_API_KEY is not set. Get your API key from https://admin.freestyle.sh"
  );
}

/**
 * Freestyle client singleton for managing Git repositories and dev servers
 */
export const freestyle = new FreestyleSandboxes({
  apiKey: process.env.FREESTYLE_API_KEY,
});

