/**
 * Exporting a MediaWiki site (Wikipedia, Fandom, any wiki with an api.php) to a folder of notes
 * the seed can push.
 *
 * Every article becomes one Markdown file named after its title, subpages as subfolders, with
 * the title, the date of its last revision, the article's URL and its revision id in front
 * matter. Navigation boxes, reference lists, images and links are dropped: they are wiki
 * furniture, and past bills by the byte. Infoboxes become a list of their fields; tables stay
 * tables. Re-running the export skips every file whose revision has not moved.
 */

import { tables } from "@joplin/turndown-plugin-gfm";
import TurndownService from "turndown";

export interface WikiSite {
  /** The api.php URL. */
  api: string;
  /** Prefix of an article's URL: the site's `articlepath` with `$1` removed. */
  articleBase: string;
  /** The site's own name, from siteinfo. */
  name: string;
}

export interface PageRef {
  pageId: number;
  title: string;
  revision: number;
  /** ISO 8601, the last revision's timestamp. */
  revised: string;
}

export interface RenderedPage {
  html: string;
  revision: number;
}

export interface FetchOptions {
  fetch?: typeof fetch;
  userAgent?: string;
}

export const DEFAULT_USER_AGENT = "past-wiki export (https://github.com/pastdotdev/past-wiki)";

/**
 * Finds the API behind a site URL. Fandom serves `/api.php`, Wikipedia `/w/api.php`; both
 * are tried, and the first that answers siteinfo wins.
 */
export async function resolveSite(url: string, options: FetchOptions = {}): Promise<WikiSite> {
  const origin = new URL(url).origin;
  const errors: string[] = [];
  for (const scriptPath of ["", "/w"]) {
    const api = `${origin}${scriptPath}/api.php`;
    try {
      const data = await apiGet<SiteInfoResponse>(api, { action: "query", meta: "siteinfo", siprop: "general" }, options);
      const general = data.query.general;
      return {
        api,
        articleBase: new URL(general.articlepath.replace("$1", ""), general.server.startsWith("//") ? `https:${general.server}` : general.server).toString(),
        name: general.sitename,
      };
    } catch (error) {
      errors.push(`${api}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`no MediaWiki API found at ${origin}\n  ${errors.join("\n  ")}`);
}

/** Every non-redirect page of a namespace, 500 at a time, with its latest revision. */
export async function* listPages(site: WikiSite, namespace = 0, options: FetchOptions = {}): AsyncGenerator<PageRef[]> {
  let cont: Record<string, string> = {};
  for (;;) {
    const data = await apiGet<AllPagesResponse>(
      site.api,
      {
        action: "query",
        generator: "allpages",
        gapnamespace: String(namespace),
        gapfilterredir: "nonredirects",
        gaplimit: "500",
        prop: "revisions",
        rvprop: "ids|timestamp",
        ...cont,
      },
      options,
    );
    const pages = (data.query?.pages ?? []).flatMap((page) => {
      const revision = page.revisions?.[0];
      if (!revision) return [];
      return [{ pageId: page.pageid, title: page.title, revision: revision.revid, revised: revision.timestamp }];
    });
    if (pages.length > 0) yield pages;
    if (!data.continue) return;
    cont = data.continue;
  }
}

/** The article's rendered HTML, as the site's parser produces it, plus the revision it came from. */
export async function renderPage(site: WikiSite, title: string, options: FetchOptions = {}): Promise<RenderedPage> {
  const data = await apiGet<ParseResponse>(
    site.api,
    { action: "parse", page: title, prop: "text|revid", disableeditsection: "1", disabletoc: "1" },
    options,
  );
  return { html: data.parse.text, revision: data.parse.revid };
}

/** Classes whose elements are wiki furniture rather than content. Wikipedia and Fandom names. */
const DROPPED_CLASSES = [
  "navibox",
  "navbox",
  "vertical-navbox",
  "sidebar",
  "mw-references-wrap",
  "references",
  "reflist",
  "reference",
  "thumb",
  "gallery",
  "toc",
  "mw-editsection",
  "mw-empty-elt",
  "noprint",
  "metadata",
  "ambox",
  "hatnote",
  "vde",
  "pi-image",
  "mw-jump-link",
  "article-tabs",
  "onlymobile",
];

const DROPPED_TAGS = new Set(["IMG", "FIGURE", "SCRIPT", "STYLE", "AUDIO", "VIDEO", "MAP"]);

function hasClass(node: Node, classes: string[]): boolean {
  const list = (node as Element).classList;
  return list !== undefined && classes.some((name) => list.contains(name));
}

function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** An infobox value as one line: citations gone, line breaks as separators. */
function valueText(node: Element | null): string {
  if (!node) return "";
  for (const citation of Array.from(node.querySelectorAll("sup.reference, .cite-bracket"))) citation.remove();
  for (const lineBreak of Array.from(node.querySelectorAll("br"))) lineBreak.replaceWith("; ");
  return text(node).replace(/\s*;\s*(;\s*)+/g, "; ").replace(/^; |; $/g, "");
}

/**
 * A one-row, two-cell table whose first cell holds only an image is a message banner
 * ("this is a featured article"), whatever template drew it.
 */
function isBanner(node: Element): boolean {
  if (node.nodeName !== "TABLE") return false;
  const rows = node.querySelectorAll("tr");
  if (rows.length !== 1) return false;
  const cells = Array.from(rows[0]?.children ?? []);
  return cells.length === 2 && cells[0]?.querySelector("img") !== null && text(cells[0] ?? null) === "";
}

/** A portable infobox (Fandom) or a Wikipedia infobox table as `- label: value` lines. */
function infoboxToMarkdown(node: Element): string {
  const lines: string[] = [];
  const title = text(node.querySelector(".pi-title, .infobox-title, caption"));
  if (title) lines.push(`**${title}**`);
  for (const item of Array.from(node.querySelectorAll(".pi-data, tr"))) {
    const label = text(item.querySelector(".pi-data-label, th")).replace(/:$/, "");
    const value = valueText(item.querySelector(".pi-data-value, td"));
    if (label && value) lines.push(`- ${label}: ${value}`);
  }
  return lines.length > 0 ? `\n\n${lines.join("\n")}\n\n` : "";
}

function makeTurndown(): TurndownService {
  const service = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", hr: "---" });
  service.use(tables);
  service.addRule("infobox", {
    filter: (node) => hasClass(node, ["portable-infobox", "infobox"]),
    replacement: (_content, node) => infoboxToMarkdown(node as Element),
  });
  service.addRule("plain-link", {
    filter: "a",
    replacement: (content) => content,
  });
  // Added last so it is matched first: turndown's own `remove` yields to every other rule,
  // and the list and table rules would otherwise keep reference lists and navigation boxes.
  service.addRule("furniture", {
    filter: (node) => DROPPED_TAGS.has(node.nodeName) || hasClass(node, DROPPED_CLASSES) || isBanner(node as Element),
    replacement: () => "",
  });
  return service;
}

let turndown: TurndownService | undefined;

/** The article body as Markdown, without the furniture. */
export function toMarkdown(html: string): string {
  turndown ??= makeTurndown();
  return turndown
    .turndown(html)
    .replace(/\[edit\]/g, "")
    .replace(/\\([_[\]])/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The file a title is written to: the title with the characters a file system refuses
 * replaced, `/` kept so subpages land in subfolders. Doubles as the note's data point id.
 */
export function notePath(title: string): string {
  const cleaned = title
    .split("/")
    .map((part) => part.replace(/[\\:*?"<>|]/g, "_").replace(/^\.+/, "_").trim() || "_")
    .join("/");
  return `${cleaned}.md`;
}

export interface ExportedNote {
  path: string;
  text: string;
}

/** The note for one article: front matter the seed reads, then the heading and the body. */
export function toNote(site: WikiSite, page: PageRef, rendered: RenderedPage): ExportedNote {
  const body = toMarkdown(rendered.html);
  const front = [
    "---",
    `title: ${page.title}`,
    `date: ${page.revised}`,
    `source: ${site.articleBase}${encodeURI(page.title.replace(/ /g, "_"))}`,
    `revision: ${rendered.revision}`,
    "---",
  ].join("\n");
  return { path: notePath(page.title), text: `${front}\n# ${page.title}\n\n${body}\n` };
}

/** The `revision:` a note was exported from, so an unchanged article is not fetched again. */
export function exportedRevision(text: string): number | null {
  const match = /^revision: (\d+)$/m.exec(text.slice(0, 2000));
  return match?.[1] ? Number(match[1]) : null;
}

interface SiteInfoResponse {
  query: { general: { sitename: string; server: string; articlepath: string } };
}

interface AllPagesResponse {
  continue?: Record<string, string>;
  query?: { pages?: { pageid: number; title: string; revisions?: { revid: number; timestamp: string }[] }[] };
}

interface ParseResponse {
  parse: { text: string; revid: number };
}

interface ApiError {
  error?: { code: string; info: string };
}

const RETRIES = 4;

async function apiGet<T>(api: string, params: Record<string, string>, options: FetchOptions): Promise<T> {
  const fetchImpl = options.fetch ?? fetch;
  const url = new URL(api);
  for (const [key, value] of Object.entries({ ...params, format: "json", formatversion: "2" })) {
    url.searchParams.set(key, value);
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers: { "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT } });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`${response.status} from ${url.host}`);
      }
      if (!response.ok) {
        throw new NoRetry(`${response.status} from ${url.host} for ${params.page ?? params.action}`);
      }
      const data = (await response.json()) as T & ApiError;
      if (data.error) throw new NoRetry(`${data.error.code}: ${data.error.info}`);
      return data;
    } catch (error) {
      if (error instanceof NoRetry) throw error;
      lastError = error;
      if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

class NoRetry extends Error {}
