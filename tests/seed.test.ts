import { describe, expect, it } from "vitest";

import { PastClient } from "@/lib/past/client";
import { PUSH_SIZE, noteTitle, parseFrontMatter, pushItems, toIngestItem, waitSettled } from "@/lib/wiki/seed";

const FALLBACK = new Date("2026-01-01T00:00:00Z");

describe("toIngestItem", () => {
  it("uses the path as id, the heading as label and the front matter date as timestamp", () => {
    const item = toIngestItem({
      path: "team/onboarding.md",
      text: "---\ndate: 2026-03-04\nauthor: x\n---\n# Onboarding\n\nDay one: get a laptop.\n",
      fallbackDate: FALLBACK,
    });

    expect(item).toEqual({
      id: "team/onboarding.md",
      content: "# Onboarding\n\nDay one: get a laptop.",
      timestamp: "2026-03-04T00:00:00.000Z",
      label: "Onboarding",
      metadata: { path: "team/onboarding.md", title: "Onboarding" },
    });
  });

  it("falls back to the file date and the file name", () => {
    const item = toIngestItem({ path: "notes/2026-q1.txt", text: "Plain text.", fallbackDate: FALLBACK });

    expect(item.timestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(item.label).toBe("2026-q1");
  });

  it("prefers a front matter title over the heading", () => {
    const item = toIngestItem({
      path: "a.md",
      text: '---\ntitle: "Given title"\n---\n# Heading\n',
      fallbackDate: FALLBACK,
    });
    expect(item.label).toBe("Given title");
  });

  it("refuses an empty note and a bad date", () => {
    expect(() => toIngestItem({ path: "e.md", text: "---\ndate: 2026-01-01\n---\n", fallbackDate: FALLBACK })).toThrow(
      "e.md is empty",
    );
    expect(() => toIngestItem({ path: "d.md", text: "---\ndate: soon\n---\nx", fallbackDate: FALLBACK })).toThrow(
      'd.md: front matter date "soon" is not a date',
    );
  });
});

describe("parseFrontMatter / noteTitle", () => {
  it("leaves text without a block untouched", () => {
    expect(parseFrontMatter("# Hi\n")).toEqual({ body: "# Hi\n" });
  });

  it("finds the first heading anywhere in the body", () => {
    expect(noteTitle("x.md", "intro\n\n# Real title  \n## sub")).toBe("Real title");
  });
});

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function fakePast(settledAfter = 1) {
  const calls: Call[] = [];
  let reads = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as { items: unknown[] }) : null;
    calls.push({ path: url.pathname, method, body });
    if (url.pathname === "/api/v1/ingest/batch" && body) {
      return Response.json({
        ingestionId: `push-${calls.filter((c) => c.method === "POST").length}`,
        status: "accepted",
        items: body.items.map((_, ordinal) => ({ ordinal, sourceId: `s${ordinal}`, status: "accepted", unchanged: ordinal === 0 })),
      });
    }
    reads += 1;
    return Response.json({
      status: "processing",
      settled: reads > settledAfter,
      blocked: false,
      readiness: { raw: 0, comprehension: 0, consolidation: 0, parked: 0 },
    });
  };
  return { calls, client: new PastClient({ apiKey: "past_sk_test", baseUrl: "https://past.example", fetch: fetchImpl }) };
}

describe("pushItems", () => {
  it("batches and counts what changed", async () => {
    const { calls, client } = fakePast();
    const items = Array.from({ length: PUSH_SIZE + 1 }, (_, i) => ({
      id: `n${i}`,
      content: "x",
      timestamp: "2026-01-01T00:00:00.000Z",
    }));

    const summary = await pushItems(client, items);

    expect(summary).toEqual({ pushed: PUSH_SIZE + 1, changed: PUSH_SIZE - 1, unchanged: 2, ingestionIds: ["push-1", "push-2"] });
    expect(calls.map((c) => c.path)).toEqual(["/api/v1/ingest/batch", "/api/v1/ingest/batch"]);
  });
});

describe("waitSettled", () => {
  it("polls until every push is settled", async () => {
    const { calls, client } = fakePast(2);
    const slept: number[] = [];

    await waitSettled(client, ["push-1"], { intervalMs: 10, sleep: async (ms) => void slept.push(ms) });

    expect(calls.filter((c) => c.method === "GET")).toHaveLength(3);
    expect(slept).toEqual([10, 10]);
  });

  it("gives up after the timeout", async () => {
    const { client } = fakePast(100);

    await expect(waitSettled(client, ["push-1"], { intervalMs: 10, timeoutMs: 20, sleep: async () => {} })).rejects.toThrow(
      "1 push(es) still processing after 0s",
    );
  });
});
