import { describe, expect, it } from "vitest";
import { configuredAnswerer } from "@/lib/wiki/answer";
import type { RecallResponse } from "@/lib/past/types";

const evidence: RecallResponse = {
  asOf: "2026-09-01T00:00:00Z", usedEvidenceTokens: 10,
  results: [{ id: "doc-1", rank: 1, occurredAt: "2026-08-01T00:00:00Z", content: "Budget is 40k.",
    artifact: { id: "a1", kind: "claim", occurredAt: "2026-08-01T00:00:00Z" },
    sources: [{ sourceId: "source-1", occurredAt: "2026-08-01T00:00:00Z", excerpts: ["40k"] }] }],
};
function completion(answer: unknown, disposition = "answered"): typeof fetch {
  return async () => Response.json({ model: "test/model", choices: [{ message: { content: JSON.stringify({ answer, disposition }) } }] });
}
describe("application-side article generation", () => {
  it("is disabled without a model key", () => {
    expect(configuredAnswerer({})).toBeNull();
  });
  it("sends evidence to OpenRouter and maps only real document citations", async () => {
    let sent: Record<string, unknown> = {};
    const fake: typeof fetch = async (url, init) => {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer model-key");
      sent = JSON.parse(String(init?.body));
      return completion("Budget is 40k d1.")(url, init);
    };
    const generate = configuredAnswerer({ OPENROUTER_API_KEY: "model-key", OPENROUTER_MODEL: "test/model" }, fake)!;
    const answer = await generate("Budget?", evidence);
    expect(sent.model).toBe("test/model");
    expect(JSON.stringify(sent)).toContain("source-1");
    expect(JSON.stringify(sent)).not.toContain("model-key");
    expect(answer.citedDocumentIds).toEqual(new Set(["doc-1"]));
  });
  it.each(["Unknown d99.", "No source given.", "", 42])("rejects unsupported or malformed answers: %s", async (text) => {
    const generate = configuredAnswerer({ OPENROUTER_API_KEY: "test" }, completion(text))!;
    await expect(generate("Budget?", evidence)).rejects.toThrow();
  });
  it("allows an explicit abstention", async () => {
    const generate = configuredAnswerer({ OPENROUTER_API_KEY: "test" }, completion("The evidence does not say.", "abstained"))!;
    expect((await generate("Unknown?", evidence)).disposition).toBe("abstained");
  });
  it("rejects provider failures", async () => {
    const generate = configuredAnswerer({ OPENROUTER_API_KEY: "test" }, async () => new Response("", { status: 503 }))!;
    await expect(generate("Budget?", evidence)).rejects.toThrow("503");
  });
});
