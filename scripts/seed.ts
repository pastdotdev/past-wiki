/**
 * `npm run seed -- <folder>`: push a folder of Markdown or text notes into the wiki's project
 * and wait until they are readable. Run it again after editing notes; only changed files are
 * reprocessed.
 *
 *   npm run seed                   # the bundled sample notes
 *   npm run seed -- ./docs         # your own folder
 *   npm run seed -- ./docs --no-wait
 *   npm run seed -- ./docs --dry-run
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { PastClient } from "@/lib/past/client";
import type { IngestItem } from "@/lib/past/types";
import { readConfig } from "@/lib/wiki/config";
import { NOTE_EXTENSIONS, pushItems, toIngestItem, waitSettled, type Note } from "@/lib/wiki/seed";

interface Args {
  folder: string;
  wait: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { folder: "sample", wait: true, dryRun: false };
  for (const arg of argv) {
    if (arg === "--no-wait") args.wait = false;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else args.folder = arg;
  }
  return args;
}

async function collectNotes(root: string): Promise<Note[]> {
  const notes: Note[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (NOTE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const [text, info] = await Promise.all([readFile(full, "utf8"), stat(full)]);
        notes.push({
          path: path.relative(root, full).split(path.sep).join("/"),
          text,
          fallbackDate: info.mtime,
        });
      }
    }
  }
  await walk(root);
  return notes;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.folder);
  const notes = await collectNotes(root);
  if (notes.length === 0) {
    throw new Error(`no .md, .markdown or .txt files under ${root}`);
  }
  const items: IngestItem[] = notes.map(toIngestItem);
  for (const item of items) {
    console.log(`${item.timestamp.slice(0, 10)}  ${item.id}`);
  }
  console.log(`${items.length} note(s) in ${root}`);
  if (args.dryRun) return;

  const config = readConfig();
  const client = new PastClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  const summary = await pushItems(client, items);
  console.log(`pushed ${summary.pushed}: ${summary.changed} new or changed, ${summary.unchanged} unchanged`);
  if (!args.wait || summary.changed === 0) return;

  process.stdout.write("waiting for past to process them");
  await waitSettled(client, summary.ingestionIds, { onPoll: () => process.stdout.write(".") });
  console.log("\nready. Start the wiki and ask it something.");
}

main().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
