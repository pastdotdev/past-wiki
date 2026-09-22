import { PastApiError, type PastClient } from "@/lib/past/client";
import { pageFromAnswer, pageFromRecall, type WikiPage } from "./page";

export interface AskOptions {
  identity: string;
  /** ISO 8601. When set, the page reads the project as it was at that instant. */
  asOf?: string;
  now?: () => Date;
}

const ARTICLE_INSTRUCTIONS =
  "Write the answer as a short encyclopedia-style article: a direct opening sentence, then the " +
  "supporting facts in order. Cite sources inline with their dN reference after the sentence they " +
  "support. Do not add headings.";

/**
 * Asks past one question and returns a wiki page.
 *
 * The server's answerer writes the article when it exists. A deployment without one refuses
 * `/answer` with 503 `answerer-not-configured`; the wiki then serves the ranked evidence
 * from `/recall` as the page body instead of failing.
 */
export async function ask(client: PastClient, question: string, options: AskOptions): Promise<WikiPage> {
  const askedAt = (options.now ?? (() => new Date()))().toISOString();
  const request = {
    query: question,
    identity: options.identity,
    queryTimestamp: options.asOf,
    limit: 20,
    maxTokens: 8000,
  };
  try {
    const response = await client.answer({ ...request, instructions: ARTICLE_INSTRUCTIONS });
    return pageFromAnswer(question, askedAt, response);
  } catch (error) {
    if (!(error instanceof PastApiError) || error.code !== "answerer-not-configured") throw error;
  }
  const response = await client.recall(request);
  return pageFromRecall(question, askedAt, response);
}
