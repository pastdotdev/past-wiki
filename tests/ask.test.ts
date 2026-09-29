import { describe, expect, it } from "vitest";
import { PastApiError, PastClient } from "@/lib/past/client";
import type { RecallResponse } from "@/lib/past/types";
import { ask } from "@/lib/wiki/ask";

const recallPage: RecallResponse = {
  asOf: "2026-09-01T00:00:00Z",
  usedEvidenceTokens: 120,
  results: [
    {
      id: "doc-1",
      rank: 1,
      occurredAt: "2026-07-28T16:00:00Z",
      content: "The Acme pilot budget is 40k.",
      artifact: { id: "a1", kind: "state", occurredAt: "2026-07-28T16:00:00Z" },
      sources: [{ sourceId: "email-12", occurredAt: "2026-07-28T16:00:00Z", metadata: { title: "Budget email" }, excerpts: ["Budget moved to 40k."] }],
    },
    {
      id: "doc-2",
      rank: 2,
      occurredAt: "2026-06-01T09:00:00Z",
      content: "Kickoff notes.",
      artifact: { id: "a2", kind: "source", occurredAt: "2026-06-01T09:00:00Z" },
      sources: [{ sourceId: "notes-3", occurredAt: "2026-06-01T09:00:00Z", excerpts: [] }],
    },
  ],
};

const answerer = async () => ({
  text: "The budget is 40k d1.", disposition: "answered" as const, model: "test-model",
  citedDocumentIds: new Set(["doc-1"]),
});

interface Call {
  path: string;
  body: Record<string, unknown>;
  authorization: string | null;
}

function fakePast(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    calls.push({
      path: url.pathname,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      authorization: headers.get("authorization"),
    });
    const route = routes[url.pathname];
    if (!route) return new Response("not found", { status: 404 });
    return route();
  };
  const client = new PastClient({ apiKey: "past_sk_org_secret", baseUrl: "https://past.example/", fetch: fetchImpl });
  return { client, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ask", () => {
  it("recalls evidence before generating an article and marking citations", async () => {
    const { client, calls } = fakePast({ "/api/v1/recall": () => json(recallPage) });

    const page = await ask(client, "what is the budget?", { identity: "wiki", answerer, now: () => new Date("2026-09-08T10:00:00Z") });

    expect(page.mode).toBe("answer");
    expect(page.article?.text).toBe("The budget is 40k d1.");
    expect(page.sources.map((source) => [source.number, source.cited])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(page.askedAt).toBe("2026-09-08T10:00:00.000Z");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authorization).toBe("Bearer past_sk_org_secret");
    expect(calls[0]?.body).toMatchObject({ query: "what is the budget?", identity: "wiki" });
    expect(calls[0]?.path).toBe("/api/v1/recall");
    expect(calls[0]?.body).not.toHaveProperty("instructions");
  });

  it("shows evidence directly when no app-side model is configured", async () => {
    const { client, calls } = fakePast({
      "/api/v1/recall": () => json(recallPage),
    });

    const page = await ask(client, "what is the budget?", { identity: "wiki", answerer: null });

    expect(page.mode).toBe("evidence");
    expect(page.article).toBeNull();
    expect(page.sources.map((source) => source.number)).toEqual([1, 2]);
    expect(page.sources.every((source) => !source.cited)).toBe(true);
    expect(calls.map((call) => call.path)).toEqual(["/api/v1/recall"]);
    expect(calls[0]?.body).not.toHaveProperty("instructions");
  });

  it("keeps evidence readable when the model fails", async () => {
    const { client, calls } = fakePast({ "/api/v1/recall": () => json(recallPage) });
    const page = await ask(client, "budget?", { identity: "wiki", answerer: async () => { throw new Error("unavailable"); } });
    expect(page.mode).toBe("evidence");
    expect(page.sources).toHaveLength(2);
    expect(calls.map((call) => call.path)).toEqual(["/api/v1/recall"]);
  });

  it("passes the as-of instant through unchanged", async () => {
    const { client, calls } = fakePast({ "/api/v1/recall": () => json(recallPage) });

    await ask(client, "budget?", { identity: "wiki", answerer: null, asOf: "2026-07-01T00:00:00Z" });

    expect(calls[0]?.body.queryTimestamp).toBe("2026-07-01T00:00:00Z");
  });

  it("surfaces every other refusal as a PastApiError with its code", async () => {
    const { client } = fakePast({
      "/api/v1/recall": () => json({ code: "unauthorized", status: 401, debugMessage: "bad key" }, 401),
    });

    await expect(ask(client, "budget?", { identity: "wiki", answerer: null })).rejects.toMatchObject({
      name: "PastApiError",
      status: 401,
      code: "unauthorized",
      message: "bad key",
    } satisfies Partial<PastApiError>);
  });

  it("still reports the status when the error body is not JSON", async () => {
    const { client } = fakePast({
      "/api/v1/recall": () => new Response("<html>bad gateway</html>", { status: 502 }),
    });

    await expect(ask(client, "budget?", { identity: "wiki", answerer: null })).rejects.toMatchObject({ status: 502, code: "unknown" });
  });
});
