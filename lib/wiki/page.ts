import type { AnswerDisposition, AnswerResponse, RecallExcerpt, RecallResponse } from "@/lib/past/types";

/** One numbered source on a wiki page. The number is the document's recall rank. */
export interface WikiSource {
  number: number;
  documentId: string;
  artifactId: string;
  kind: string;
  occurredAt: string;
  content: string;
  confidence: number | null;
  sourceId?: string;
  attributes?: Record<string, string>;
  excerpts: RecallExcerpt[];
  /** True when the answer explicitly cited this document. Always false in evidence mode. */
  cited: boolean;
}

export interface WikiArticle {
  text: string;
  disposition: AnswerDisposition;
  model: string;
}

/**
 * A page is one question and what past knows about it.
 *
 * `mode` says who wrote the body: "answer" when the server's answerer produced an article,
 * "evidence" when the deployment has no answerer and the page is the ranked evidence itself.
 */
export interface WikiPage {
  question: string;
  askedAt: string;
  asOf: string;
  mode: "answer" | "evidence";
  article: WikiArticle | null;
  sources: WikiSource[];
  usedEvidenceTokens: number;
}

export function pageFromAnswer(question: string, askedAt: string, response: AnswerResponse): WikiPage {
  const cited = new Set(response.citations.map((citation) => citation.documentId));
  return {
    question,
    askedAt,
    asOf: response.asOf,
    mode: "answer",
    article: {
      text: response.answer,
      disposition: response.disposition,
      model: response.answerer.model,
    },
    sources: sourcesFrom(response, cited),
    usedEvidenceTokens: response.usedEvidenceTokens,
  };
}

export function pageFromRecall(question: string, askedAt: string, response: RecallResponse): WikiPage {
  return {
    question,
    askedAt,
    asOf: response.asOf,
    mode: "evidence",
    article: null,
    sources: sourcesFrom(response, new Set()),
    usedEvidenceTokens: response.usedEvidenceTokens,
  };
}

function sourcesFrom(response: RecallResponse, cited: Set<string>): WikiSource[] {
  const sources: WikiSource[] = [];
  for (const result of response.results) {
    for (const document of result.documents) {
      sources.push({
        number: document.rank,
        documentId: document.id,
        artifactId: result.artifactId,
        kind: result.kind,
        occurredAt: document.occurredAt,
        content: document.content,
        confidence: document.confidence,
        sourceId: document.sourceId,
        attributes: document.attributes,
        excerpts: document.excerpts,
        cited: cited.has(document.id),
      });
    }
  }
  return sources.sort((a, b) => a.number - b.number);
}

/** The answerer refers to sources as d1, d2, ... (the document's rank). */
const CITATION_TOKEN = /\b[dD]([1-9]\d*)\b/g;

export type ArticleSegment = { type: "text"; value: string } | { type: "citation"; number: number };

/**
 * Splits one paragraph of answer text into plain runs and citation markers. A token whose
 * number matches no source on the page is left as text, so a stray "d7" never becomes a
 * dangling link.
 */
export function segmentParagraph(paragraph: string, sourceNumbers: ReadonlySet<number>): ArticleSegment[] {
  const segments: ArticleSegment[] = [];
  let last = 0;
  for (const match of paragraph.matchAll(CITATION_TOKEN)) {
    const number = Number(match[1]);
    const start = match.index;
    if (!sourceNumbers.has(number)) continue;
    if (start > last) segments.push({ type: "text", value: paragraph.slice(last, start) });
    segments.push({ type: "citation", number });
    last = start + match[0].length;
  }
  if (last < paragraph.length) segments.push({ type: "text", value: paragraph.slice(last) });
  return segments;
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
