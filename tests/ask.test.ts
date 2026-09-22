import { describe, expect, it } from "vitest";
import { PastApiError, PastClient } from "@/lib/past/client";
import type { AnswerResponse, RecallResponse } from "@/lib/past/types";
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

const answerPage: AnswerResponse = {
  ...recallPage,
  answer: "The budget is 40k d1.",
  disposition: "answered",
  citations: [{ documentId: "doc-1", sourceIds: ["email-12"] }],
  answerer: { model: "test-model" },
  usage: { totalTokens: 10, costUsd: 0 },
  timings: { recallMs: 1, answerMs: 1, totalMs: 2 },
};

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
  it("writes the article from /answer and marks cited sources", async () => {
    const { client, calls } = fakePast({ "/api/v1/answer": () => json(answerPage) });

    const page = await ask(client, "what is the budget?", { identity: "wiki", now: () => new Date("2026-09-08T10:00:00Z") });

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
    expect(typeof calls[0]?.body.instructions).toBe("string");
  });

  it("falls back to /recall when the deployment has no answerer", async () => {
    const { client, calls } = fakePast({
      "/api/v1/answer": () => json({ code: "answerer-not-configured", status: 503 }, 503),
      "/api/v1/recall": () => json(recallPage),
    });

    const page = await ask(client, "what is the budget?", { identity: "wiki" });

    expect(page.mode).toBe("evidence");
    expect(page.article).toBeNull();
    expect(page.sources.map((source) => source.number)).toEqual([1, 2]);
    expect(page.sources.every((source) => !source.cited)).toBe(true);
    expect(calls.map((call) => call.path)).toEqual(["/api/v1/answer", "/api/v1/recall"]);
    expect(calls[1]?.body).not.toHaveProperty("instructions");
  });

  it("passes the as-of instant through unchanged", async () => {
    const { client, calls } = fakePast({ "/api/v1/answer": () => json(answerPage) });

    await ask(client, "budget?", { identity: "wiki", asOf: "2026-07-01T00:00:00Z" });

    expect(calls[0]?.body.queryTimestamp).toBe("2026-07-01T00:00:00Z");
  });

  it("surfaces every other refusal as a PastApiError with its code", async () => {
    const { client } = fakePast({
      "/api/v1/answer": () => json({ code: "unauthorized", status: 401, message: "bad key" }, 401),
    });

    await expect(ask(client, "budget?", { identity: "wiki" })).rejects.toMatchObject({
      name: "PastApiError",
      status: 401,
      code: "unauthorized",
      message: "bad key",
    } satisfies Partial<PastApiError>);
  });

  it("still reports the status when the error body is not JSON", async () => {
    const { client } = fakePast({
      "/api/v1/answer": () => new Response("<html>bad gateway</html>", { status: 502 }),
    });

    await expect(ask(client, "budget?", { identity: "wiki" })).rejects.toMatchObject({ status: 502, code: "unknown" });
  });
});
