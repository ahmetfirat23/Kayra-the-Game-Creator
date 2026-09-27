/** Only retry a call when an older Convex deployment rejects a newly added field. */
export function rejectsNewSandboxField(error: unknown, fields: readonly string[]): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ArgumentValidationError") &&
    fields.some((field) => message.includes(`extra field \`${field}\``));
}

export function missingViewerRelease(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Could not find public function") &&
    message.includes("chat:releaseSandboxViewer");
}
