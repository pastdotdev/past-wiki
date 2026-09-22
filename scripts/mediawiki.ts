/**
 * `npm run mediawiki -- <site> <folder>`: export every article of a MediaWiki site to a folder
 * of notes, ready for `npm run seed -- <folder>`. Run it again later and only the articles
 * whose revision moved are fetched and rewritten.
 *
 *   npm run mediawiki -- https://onepiece.fandom.com ./onepiece
 *   npm run mediawiki -- https://en.wikipedia.org ./wp --limit 50   # a taste
 *   npm run mediawiki -- https://onepiece.fandom.com ./onepiece --namespace 0 --concurrency 3
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { exportedRevision, listPages, notePath, renderPage, resolveSite, toNote, type PageRef, type WikiSite } from "@/lib/wiki/mediawiki";

interface Args {
  site: string;
  folder: string;
  namespace: number;
  limit: number | null;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const args: Args = { site: "", folder: "", namespace: 0, limit: null, concurrency: 3 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--namespace" || arg === "--limit" || arg === "--concurrency") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 0) throw new Error(`${arg} needs a whole number`);
      if (arg === "--namespace") args.namespace = value;
      else if (arg === "--limit") args.limit = value;
      else args.concurrency = Math.max(1, value);
      index += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  const [site, folder] = positional;
  if (!site || !folder) throw new Error("usage: npm run mediawiki -- <site url> <folder> [--namespace N] [--limit N] [--concurrency N]");
  args.site = site;
  args.folder = folder;
  return args;
}

interface Tally {
  written: number;
  skipped: number;
  failed: number;
  bytes: number;
}

async function currentRevision(file: string): Promise<number | null> {
  try {
    return exportedRevision(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function exportPage(site: WikiSite, root: string, page: PageRef, tally: Tally): Promise<void> {
  const target = path.join(root, notePath(page.title));
  if ((await currentRevision(target)) === page.revision) {
    tally.skipped += 1;
    return;
  }
  try {
    const rendered = await renderPage(site, page.title);
    const written = toNote(site, page, rendered);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, written.text, "utf8");
    tally.written += 1;
    tally.bytes += Buffer.byteLength(written.text);
  } catch (error) {
    tally.failed += 1;
    console.error(`\n  failed: ${page.title}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.folder);
  const site = await resolveSite(args.site);
  console.log(`${site.name} via ${site.api}`);
  await mkdir(root, { recursive: true });

  const tally: Tally = { written: 0, skipped: 0, failed: 0, bytes: 0 };
  let listed = 0;
  const started = Date.now();
  const report = (): void => {
    const seconds = Math.round((Date.now() - started) / 1000);
    process.stdout.write(
      `\r${listed} listed, ${tally.written} written, ${tally.skipped} unchanged, ${tally.failed} failed, ${(tally.bytes / 1e6).toFixed(1)} MB, ${seconds}s`,
    );
  };

  outer: for await (const batch of listPages(site, args.namespace)) {
    for (let start = 0; start < batch.length; start += args.concurrency) {
      const slice = batch.slice(start, start + args.concurrency);
      const remaining = args.limit === null ? slice.length : Math.max(0, args.limit - listed);
      const pages = slice.slice(0, remaining);
      listed += pages.length;
      await Promise.all(pages.map((page) => exportPage(site, root, page, tally)));
      report();
      if (args.limit !== null && listed >= args.limit) break outer;
    }
  }
  console.log(`\n${tally.written + tally.skipped} note(s) in ${root}`);
  if (tally.failed > 0) {
    console.log(`${tally.failed} article(s) failed; run the export again to retry them`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
