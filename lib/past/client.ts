import type {
  AnswerRequest,
  AnswerResponse,
  ApiErrorBody,
  IngestBatchRequest,
  IngestBatchResponse,
  IngestionStatus,
  RecallRequest,
  RecallResponse,
} from "./types";

export class PastApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? `past.dev API responded ${status}`);
    this.name = "PastApiError";
    this.status = status;
    this.code = body?.code ?? "unknown";
  }
}

export interface PastClientOptions {
  apiKey: string;
  baseUrl: string;
  /** Injectable for tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** A push carries at most this many items (an API limit). */
export const MAX_PUSH_ITEMS = 1000;

/**
 * A small typed client over the endpoints the wiki uses: the two reads for pages, and the
 * batch push plus its status for the seed script. It runs server-side only: the project key
 * never reaches the browser.
 */
export class PastClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PastClientOptions) {
    if (!options.apiKey) throw new Error("PAST_API_KEY is required");
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  recall(request: RecallRequest): Promise<RecallResponse> {
    return this.post<RecallResponse>("/api/v1/recall", request);
  }

  answer(request: AnswerRequest): Promise<AnswerResponse> {
    return this.post<AnswerResponse>("/api/v1/answer", request);
  }

  /** One ordered push of 1 to 1,000 items. */
  push(request: IngestBatchRequest): Promise<IngestBatchResponse> {
    if (request.items.length === 0 || request.items.length > MAX_PUSH_ITEMS) {
      throw new Error(`a push carries between 1 and ${MAX_PUSH_ITEMS} items`);
    }
    return this.post<IngestBatchResponse>("/api/v1/ingest/batch", request);
  }

  ingestion(ingestionId: string): Promise<IngestionStatus> {
    return this.send<IngestionStatus>("GET", `/api/v1/ingest/${ingestionId}`);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>("POST", path, body);
  }

  private async send<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new PastApiError(response.status, parseErrorBody(text));
    }
    return JSON.parse(text) as T;
  }
}

function parseErrorBody(text: string): ApiErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && "code" in parsed) {
      return parsed as ApiErrorBody;
    }
  } catch {
    // A non-JSON body (a proxy page, an empty response) carries no code.
  }
  return null;
}
