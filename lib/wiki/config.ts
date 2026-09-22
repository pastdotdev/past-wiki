import { PastClient } from "@/lib/past/client";

export interface WikiConfig {
  apiKey: string;
  baseUrl: string;
  identity: string;
  title: string;
}

/** Reads the deployment's configuration once, failing loudly on a missing key. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): WikiConfig {
  const apiKey = env.PAST_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PAST_API_KEY is not set. Copy .env.example to .env.local and fill it in.");
  }
  return {
    apiKey,
    baseUrl: env.PAST_BASE_URL?.trim() || "https://api.past.dev",
    identity: env.PAST_IDENTITY?.trim() || "wiki",
    title: env.WIKI_TITLE?.trim() || "past wiki",
  };
}

let client: PastClient | null = null;

export function pastClient(): PastClient {
  if (client === null) {
    const config = readConfig();
    client = new PastClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  }
  return client;
}
