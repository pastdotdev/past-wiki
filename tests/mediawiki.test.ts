import { describe, expect, it } from "vitest";

import { claimPath, exportedRevision, listPages, notePath, resolveSite, toMarkdown, toNote, type WikiSite } from "@/lib/wiki/mediawiki";

const SITE: WikiSite = { api: "https://wiki.example/api.php", articleBase: "https://wiki.example/wiki/", name: "Example" };

/** A fake api.php: answers by `action`, records every query string. */
function fakeApi(answer: (params: URLSearchParams) => unknown) {
  const queries: URLSearchParams[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const params = new URL(String(input)).searchParams;
    queries.push(params);
    const body = answer(params);
    if (body === undefined) return new Response("not here", { status: 404 });
    return Response.json(body);
  };
  return { queries, fetch: fetchImpl };
}

describe("toMarkdown", () => {
  it("keeps prose, headings and tables, drops the furniture and flattens links", () => {
    const html = `
      <div class="mw-parser-output">
        <aside class="portable-infobox">
          <h2 class="pi-title">Egghead</h2>
          <figure class="pi-image"><img src="x.png"></figure>
          <div class="pi-item pi-data"><h3 class="pi-data-label">Region:</h3><div class="pi-data-value">New <a href="/wiki/World">World</a><sup class="reference">[2]</sup><br>Grand Line</div></div>
          <div class="pi-item pi-data"><h3 class="pi-data-label">Empty</h3><div class="pi-data-value"></div></div>
        </aside>
        <table style="border-left: 10px solid blue"><tr><td><img src="star.png"></td><td><b>This is a featured article.</b></td></tr></table>
        <div class="article-tabs"><ul><li>Main</li><li>Gallery</li></ul></div>
        <p>Egghead is an <a href="/wiki/Island">island</a> in the New World.<sup class="reference">[1]</sup></p>
        <h2><span class="mw-headline">Story</span><span class="mw-editsection">[edit]</span></h2>
        <div class="thumb"><img src="pic.png"><div class="thumbcaption">A picture</div></div>
        <table class="wikitable"><tr><th>Chapter</th><th>Title</th></tr><tr><td>1058</td><td>New Emperors</td></tr></table>
        <ol class="references"><li>Chapter 1058</li></ol>
        <table class="navibox"><tr><td>Islands of the New World</td></tr></table>
      </div>`;

    expect(toMarkdown(html)).toBe(
      [
        "**Egghead**",
        "- Region: New World; Grand Line",
        "",
        "Egghead is an island in the New World.",
        "",
        "## Story",
        "",
        "| Chapter | Title |",
        "| --- | --- |",
        "| 1058 | New Emperors |",
      ].join("\n"),
    );
  });

  it("reads a Wikipedia infobox table the same way", () => {
    const html = `<table class="infobox"><caption>Spain</caption><tr><th>Coach</th><td>Luis de la Fuente</td></tr></table><p>Text.</p>`;
    expect(toMarkdown(html)).toBe("**Spain**\n- Coach: Luis de la Fuente\n\nText.");
  });
});

describe("notePath / toNote / exportedRevision", () => {
  it("names the file after the title, subpages as folders, illegal characters replaced", () => {
    expect(notePath("Monkey D. Luffy/History/Non-Canon")).toBe("Monkey D. Luffy/History/Non-Canon.md");
    expect(notePath('Who: "What"? *')).toBe("Who_ _What__ _.md");
    expect(notePath("../x")).toBe("_/x.md");
  });

  it("keeps two titles apart when the file system folds case", () => {
    const claimed = new Set<string>();
    expect(claimPath("SWORD", claimed)).toBe("SWORD.md");
    expect(claimPath("Sword", claimed)).toBe("Sword (2).md");
    expect(claimPath("Sword", claimed)).toBe("Sword (3).md");
  });

  it("writes the front matter the seed reads and the revision the next export checks", () => {
    const note = toNote(
      SITE,
      { pageId: 7, title: "Egghead Arc", revision: 42, revised: "2026-09-10T12:34:56Z" },
      { html: "<p>Body.</p>", revision: 43 },
    );

    expect(note.path).toBe("Egghead Arc.md");
    expect(note.text).toBe(
      "---\ntitle: Egghead Arc\ndate: 2026-09-10T12:34:56Z\nsource: https://wiki.example/wiki/Egghead_Arc\nrevision: 43\n---\n# Egghead Arc\n\nBody.\n",
    );
    expect(exportedRevision(note.text)).toBe(43);
    expect(exportedRevision("no front matter")).toBeNull();
  });
});

describe("resolveSite", () => {
  it("tries /api.php then /w/api.php and reads the article path from siteinfo", async () => {
    const { queries, fetch } = fakeApi((params) =>
      params.get("meta") === "siteinfo" ? { query: { general: { sitename: "Wikipedia", server: "//en.wikipedia.org", articlepath: "/wiki/$1" } } } : undefined,
    );
    const failing: typeof fetch = async (input) => (String(input).includes("/w/api.php") ? fetch(input) : new Response("", { status: 404 }));

    const site = await resolveSite("https://en.wikipedia.org/wiki/Main_Page", { fetch: failing });

    expect(site).toEqual({ api: "https://en.wikipedia.org/w/api.php", articleBase: "https://en.wikipedia.org/wiki/", name: "Wikipedia" });
    expect(queries).toHaveLength(1);
  });
});

describe("listPages", () => {
  it("follows continue and keeps only pages with a revision", async () => {
    const { queries, fetch } = fakeApi((params) =>
      params.has("gapcontinue")
        ? { query: { pages: [{ pageid: 2, title: "B", revisions: [{ revid: 20, timestamp: "2026-02-02T00:00:00Z" }] }] } }
        : {
            continue: { gapcontinue: "B", continue: "gapcontinue||" },
            query: { pages: [{ pageid: 1, title: "A", revisions: [{ revid: 10, timestamp: "2026-01-01T00:00:00Z" }] }, { pageid: 3, title: "C" }] },
          },
    );

    const batches: string[][] = [];
    for await (const batch of listPages(SITE, 0, { fetch })) batches.push(batch.map((page) => `${page.title}@${page.revision}`));

    expect(batches).toEqual([["A@10"], ["B@20"]]);
    expect(queries[0]?.get("gapfilterredir")).toBe("nonredirects");
    expect(queries[1]?.get("continue")).toBe("gapcontinue||");
  });
});
