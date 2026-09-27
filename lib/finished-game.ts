/**
 * A finished game is the files Kayra wrote before the last successful commit.
 * The VM disk is not persistent, so Reload replays this onto a new machine
 * before Expo starts.
 */

export type TextEdit = {
  oldText: string;
  newText: string;
};

export type FinishedGame = {
  files: Array<{ path: string; content: string }>;
  diskEdits: Array<{ path: string; edits: TextEdit[] }>;
};

const GAME_SCREEN = "/template/app/(tabs)/index.tsx";

export function safeTemplatePath(input: string): string | null {
  const path = input.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!path.startsWith("/template/")) return null;
  if (path.split("/").includes("..")) return null;
  if (path.endsWith("/")) return null;
  return path;
}

export function applyTextEdits(content: string, edits: TextEdit[]): string {
  let next = content;
  for (const edit of edits) {
    if (!edit.oldText || !next.includes(edit.oldText)) continue;
    next = next.replace(edit.oldText, edit.newText);
  }
  return next;
}

export function includesGameScreen(game: FinishedGame | null | undefined): boolean {
  if (!game) return false;
  return (
    game.files.some((file) => file.path === GAME_SCREEN) ||
    game.diskEdits.some((edit) => edit.path === GAME_SCREEN)
  );
}

type ToolPart = {
  type?: string;
  state?: string;
  input?: unknown;
  args?: unknown;
  output?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toolName(part: ToolPart): string | null {
  if (!part.type?.startsWith("tool-")) return null;
  return part.type.slice("tool-".length);
}

function callSettled(part: ToolPart): boolean {
  if (part.state === "output-error") return false;
  if (part.state === "input-streaming" || part.state === "input-available") return false;
  if (part.state === "output-available") return true;
  return part.output !== undefined;
}

function unwrapOutput(output: unknown): unknown {
  const record = asRecord(output);
  if (!record) return output;
  if ("value" in record && (record.type === "json" || record.type === "text")) {
    return record.value;
  }
  return output;
}

function outputText(output: unknown): string {
  const value = unwrapOutput(output);
  if (typeof value === "string") return value;
  if (typeof output === "string") return output;
  return "";
}

function commitSucceeded(part: ToolPart): boolean {
  const name = toolName(part);
  if (name !== "commitAndPush" && name !== "git_commit_and_push") return false;
  if (!callSettled(part)) return false;
  return !/^Error committing/i.test(outputText(part.output));
}

/** Number of successful commits currently visible in the UI message history. */
export function successfulCommitCountFromUiMessages(
  messages: Array<{ parts?: unknown }>,
): number {
  let count = 0;
  for (const message of messages) {
    if (!Array.isArray(message.parts)) continue;
    for (const part of message.parts) {
      if (part && typeof part === "object" && commitSucceeded(part as ToolPart)) {
        count += 1;
      }
    }
  }
  return count;
}

function failedWritePaths(output: unknown): Set<string> {
  const failed = new Set<string>();
  const record = asRecord(unwrapOutput(output));
  if (!record || !Array.isArray(record.files)) return failed;
  for (const file of record.files) {
    const item = asRecord(file);
    if (!item || item.success !== false || typeof item.path !== "string") continue;
    const path = safeTemplatePath(item.path);
    if (path) failed.add(path);
  }
  return failed;
}

function writtenFiles(input: unknown): Array<{ path: string; content: string }> {
  const record = asRecord(input);
  if (!record) return [];
  if (typeof record.path === "string" && typeof record.content === "string") {
    const path = safeTemplatePath(record.path);
    return path ? [{ path, content: record.content }] : [];
  }
  if (!Array.isArray(record.files)) return [];
  const files: Array<{ path: string; content: string }> = [];
  for (const file of record.files) {
    const item = asRecord(file);
    if (!item || typeof item.path !== "string" || typeof item.content !== "string") continue;
    const path = safeTemplatePath(item.path);
    if (!path) continue;
    files.push({ path, content: item.content });
  }
  return files;
}

function editedFiles(input: unknown): Array<{ path: string; edits: TextEdit[] }> {
  const record = asRecord(input);
  if (!record) return [];
  const sources = Array.isArray(record.files)
    ? record.files
    : typeof record.path === "string"
      ? [record]
      : [];
  const files: Array<{ path: string; edits: TextEdit[] }> = [];
  for (const source of sources) {
    const item = asRecord(source);
    if (!item || typeof item.path !== "string" || !Array.isArray(item.edits)) continue;
    const path = safeTemplatePath(item.path);
    if (!path) continue;
    const edits: TextEdit[] = [];
    for (const edit of item.edits) {
      const change = asRecord(edit);
      if (!change || typeof change.oldText !== "string" || typeof change.newText !== "string") {
        continue;
      }
      edits.push({ oldText: change.oldText, newText: change.newText });
    }
    if (edits.length > 0) files.push({ path, edits });
  }
  return files;
}

function isWrite(name: string): boolean {
  return name === "writeFiles" || name === "write_file";
}

function isEdit(name: string): boolean {
  return name === "editFiles" || name === "edit_file";
}

/** Replay settled tool parts up to the last successful commit. */
export function finishedGameFromParts(parts: unknown[]): FinishedGame | null {
  const tools = parts.filter((part): part is ToolPart => {
    return Boolean(part && typeof part === "object");
  });
  let commitIndex = -1;
  for (let index = 0; index < tools.length; index++) {
    if (commitSucceeded(tools[index])) commitIndex = index;
  }
  if (commitIndex < 0) return null;

  const known = new Map<string, string>();
  const pending = new Map<string, TextEdit[]>();

  for (const part of tools.slice(0, commitIndex)) {
    const name = toolName(part);
    if (!name || !callSettled(part)) continue;
    const input = part.input ?? part.args;
    if (isWrite(name)) {
      const failed = failedWritePaths(part.output);
      for (const file of writtenFiles(input)) {
        if (failed.has(file.path)) continue;
        known.set(file.path, file.content);
        pending.delete(file.path);
      }
      continue;
    }
    if (isEdit(name)) {
      for (const file of editedFiles(input)) {
        const current = known.get(file.path);
        if (current !== undefined) {
          known.set(file.path, applyTextEdits(current, file.edits));
          continue;
        }
        const queued = pending.get(file.path) ?? [];
        queued.push(...file.edits);
        pending.set(file.path, queued);
      }
    }
  }

  if (known.size === 0 && pending.size === 0) return null;
  return {
    files: [...known].map(([path, content]) => ({ path, content })),
    diskEdits: [...pending].map(([path, edits]) => ({ path, edits })),
  };
}

export function finishedGameFromUiMessages(
  messages: Array<{ parts?: unknown; order?: number; stepOrder?: number }>,
): FinishedGame | null {
  // listThreadMessages sorts each page oldest-first, but pages themselves arrive
  // newest-window first. Sort on the message order so a later commit wins.
  const chronological = [...messages].sort((a, b) => {
    const byOrder = (a.order ?? 0) - (b.order ?? 0);
    if (byOrder !== 0) return byOrder;
    return (a.stepOrder ?? 0) - (b.stepOrder ?? 0);
  });
  const parts: unknown[] = [];
  for (const message of chronological) {
    if (Array.isArray(message.parts)) parts.push(...message.parts);
  }
  return finishedGameFromParts(parts);
}
