/** Marks a follow-up the chat hides. The agent still receives the text. */
export const COMPILE_FIX_MARKER = "kayra-compile-fix";

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
