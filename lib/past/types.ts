/**
 * The parts of the past.dev Memory API this wiki uses.
 * Reference: https://past.dev/docs/memory-api/api-reference
 */

export interface RecallRequest {
  query: string;
  /** The identity the read answers as. Required by the API. */
  identity: string;
  limit?: number;
  maxTokens?: number;
  /** ISO 8601. Anchors the read at a past instant ("as of then"). */
  queryTimestamp?: string;
  sort?: "relevance" | "chronological";
}

export interface AnswerRequest extends RecallRequest {
  instructions?: string;
}

/** Where a recalled document came from: the pushed data point, quoted where past kept a quote. */
export interface RecallSource {
  /** The id the data point was pushed with. */
  sourceId: string;
  occurredAt: string;
  /** The data point's metadata as pushed, when it had any. */
  metadata?: Record<string, unknown>;
  /** Quotations from the source that back the document. Empty for a source document itself. */
  excerpts: string[];
}

/** The memory a recalled document belongs to. */
export interface RecallArtifact {
  id: string;
  /** "source", "membership", "state", "episode", ... */
  kind: string;
  occurredAt: string;
}

/** One recalled document: the unit of recall, ranked page-wide by relevance (1 is best). */
export interface RecallResult {
  id: string;
  rank: number;
  occurredAt: string;
  content: string;
  artifact: RecallArtifact;
  sources: RecallSource[];
}

export interface RecallResponse {
  asOf: string;
  usedEvidenceTokens: number;
  results: RecallResult[];
}

export type AnswerDisposition = "answered" | "abstained" | "clarification_required";

export interface AnswerCitation {
  documentId: string;
  sourceIds: string[];
}

export interface AnswerResponse extends RecallResponse {
  answer: string;
  disposition: AnswerDisposition;
  citations: AnswerCitation[];
  answerer: { model: string };
  usage: { totalTokens: number; costUsd: number };
  timings: { recallMs: number; answerMs: number; totalMs: number };
}

/**
 * One item of a push. `id` is the caller's stable identifier: re-pushing the same id with
 * the same content is a no-op on past's side.
 */
export interface IngestItem {
  id: string;
  content: string;
  /** ISO 8601. When the knowledge was true, not when it was pushed. */
  timestamp: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestBatchRequest {
  items: IngestItem[];
  idempotencyKey?: string;
}

export interface IngestBatchItemResult {
  ordinal: number;
  sourceId: string;
  status: string;
  unchanged?: boolean;
}

export interface IngestBatchResponse {
  ingestionId: string;
  status: string;
  unchanged?: boolean;
  items: IngestBatchItemResult[];
}

export interface IngestionStatus {
  status: string;
  /** True once every point of the push is fully processed and readable. */
  settled: boolean;
  blocked: boolean;
  readiness: { raw: number; comprehension: number; consolidation: number; parked: number };
}

/** Every refusal from the API has this body. */
export interface ApiErrorBody {
  code: string;
  status: number;
  message?: string;
}
