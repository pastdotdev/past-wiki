import type { PastClient } from "@/lib/past/client";
import { configuredAnswerer, type Answerer } from "./answer";
import { pageFromAnswer, pageFromRecall, type WikiPage } from "./page";

export interface AskOptions {
  identity: string;
  /** ISO 8601. The page reads the project as it was at this instant. */
  asOf?: string;
  now?: () => Date;
  /** null disables generation; omitted reads server-side model configuration. */
  answerer?: Answerer | null;
}

/** Recall first; optionally write an article with the application's model. */
export async function ask(client: PastClient, question: string, options: AskOptions): Promise<WikiPage> {
  const askedAt = (options.now ?? (() => new Date()))().toISOString();
  const response = await client.recall({
    query: question, identity: options.identity, queryTimestamp: options.asOf,
    limit: 20, maxTokens: 8000,
  });
  const answerer = options.answerer === undefined ? configuredAnswerer() : options.answerer;
  if (answerer && response.results.length > 0) {
    try {
      return pageFromAnswer(question, askedAt, response, await answerer(question, response));
    } catch {
      console.warn("Article generation unavailable; showing recalled evidence.");
    }
  }
  return pageFromRecall(question, askedAt, response);
}
