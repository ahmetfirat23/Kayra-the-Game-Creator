/** Marks a follow-up the chat hides. The agent still receives the text. */
export const COMPILE_FIX_MARKER = "kayra-compile-fix";

/** Sandbox proxy failures are infrastructure errors, not game code fixes. */
export function isPreviewInfrastructureError(error: string): boolean {
  return /Unauthorized request from\s+https?:\/\/[^\s]+[\s\S]*conflicting browser extension/i.test(error);
}

export function compileFixPrompt(error: string): string {
  const detail = error.replace(/\s+/g, " ").trim().slice(0, 4000);
  return [
    COMPILE_FIX_MARKER,
    "The game preview failed to compile. Fix the files and run commitAndPush once.",
    "Do not repeat the compiler output in your reply.",
    "",
    detail,
  ].join("\n");
}

export function isHiddenCompileFix(text: string | undefined): boolean {
  return typeof text === "string" && text.startsWith(COMPILE_FIX_MARKER);
}
