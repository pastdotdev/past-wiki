/**
 * Seeding a project from a folder of notes.
 *
 * Every Markdown or text file becomes one data point: its id is the path relative to the
 * folder, so re-running the seed after editing a file updates that one point and leaves the
 * rest untouched (past reports them as unchanged). The timestamp is when the note was true,
 * read from a `date:` front matter line when there is one.
 */

import { MAX_PUSH_ITEMS, type PastClient } from "@/lib/past/client";
import type { IngestItem } from "@/lib/past/types";

export const NOTE_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

/** Points per push. Well under the API's limit; keeps one failed push small. */
export const PUSH_SIZE = 200;

export interface Note {
  /** Path relative to the seeded folder, with forward slashes. Becomes the data point id. */
  path: string;
  /** The file's text, front matter included. */
  text: string;
  /** Used when the note carries no `date:` front matter. */
  fallbackDate: Date;
}

export interface FrontMatter {
  title?: string;
  date?: string;
  body: string;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Reads `title:` and `date:` from a leading `---` block. Anything else in it is dropped. */
export function parseFrontMatter(text: string): FrontMatter {
  const match = FRONT_MATTER.exec(text);
  if (!match) return { body: text };
  const result: FrontMatter = { body: text.slice(match[0].length) };
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key === "title" && value) result.title = value;
    if (key === "date" && value) result.date = value;
  }
  return result;
}

/** The first `# heading`, else the file name without its extension. */
export function noteTitle(path: string, body: string): string {
  const heading = /^#\s+(.+?)\s*$/m.exec(body);
  if (heading?.[1]) return heading[1];
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.[^.]+$/, "");
}

export function toIngestItem(note: Note): IngestItem {
  const front = parseFrontMatter(note.text);
  const body = front.body.trim();
  if (!body) throw new Error(`${note.path} is empty`);
  const timestamp = front.date ? parseDate(front.date, note.path) : note.fallbackDate;
  const title = front.title ?? noteTitle(note.path, body);
  return {
    id: note.path,
    content: body,
    timestamp: timestamp.toISOString(),
    label: title.slice(0, 200),
    metadata: { path: note.path, title },
  };
}

function parseDate(value: string, path: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${path}: front matter date "${value}" is not a date`);
  }
  return date;
}

export interface SeedSummary {
  pushed: number;
  changed: number;
  unchanged: number;
  ingestionIds: string[];
}

/** Pushes the items in order, PUSH_SIZE at a time. */
export async function pushItems(client: PastClient, items: IngestItem[]): Promise<SeedSummary> {
  if (PUSH_SIZE > MAX_PUSH_ITEMS) throw new Error("PUSH_SIZE exceeds the API limit");
  const summary: SeedSummary = { pushed: items.length, changed: 0, unchanged: 0, ingestionIds: [] };
  for (let start = 0; start < items.length; start += PUSH_SIZE) {
    const response = await client.push({ items: items.slice(start, start + PUSH_SIZE) });
    const unchanged = response.items.filter((item) => item.unchanged).length;
    summary.unchanged += unchanged;
    summary.changed += response.items.length - unchanged;
    summary.ingestionIds.push(response.ingestionId);
  }
  return summary;
}

export interface WaitOptions {
  /** Time between two status reads. */
  intervalMs?: number;
  /** Give up after this long. */
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onPoll?: (pending: number) => void;
}

/**
 * Resolves once every push is settled, which is when its points are readable through
 * /recall and /answer. Throws on timeout or when past reports a push as blocked.
 */
export async function waitSettled(
  client: PastClient,
  ingestionIds: string[],
  options: WaitOptions = {},
): Promise<void> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const pending = new Set(ingestionIds);
  let waited = 0;
  while (pending.size > 0) {
    for (const id of [...pending]) {
      const status = await client.ingestion(id);
      if (status.blocked) throw new Error(`push ${id} is blocked (${status.status})`);
      if (status.settled) pending.delete(id);
    }
    options.onPoll?.(pending.size);
    if (pending.size === 0) return;
    if (waited >= timeoutMs) {
      throw new Error(`${pending.size} push(es) still processing after ${Math.round(timeoutMs / 1000)}s`);
    }
    await sleep(intervalMs);
    waited += intervalMs;
  }
}
