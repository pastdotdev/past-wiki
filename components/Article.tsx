import { paragraphs, segmentParagraph, type WikiPage } from "@/lib/wiki/page";
import { formatDate } from "@/lib/wiki/format";
import { SourceCard } from "./Sources";

interface ArticleProps {
  page: WikiPage;
}

export function Article({ page }: ArticleProps) {
  const numbers = new Set(page.sources.map((source) => source.number));
  return (
    <article className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{page.question}</h1>
      <p className="mt-2 text-xs text-muted">
        As of {formatDate(page.asOf)}
        {page.article ? ` · written by ${page.article.model}` : " · evidence only"}
      </p>

      {page.article ? (
        <>
          {page.article.disposition !== "answered" && <Disposition disposition={page.article.disposition} />}
          <div className="article mt-6">
            {paragraphs(page.article.text).map((paragraph, index) => (
              <p key={index}>
                {segmentParagraph(paragraph, numbers).map((segment, position) =>
                  segment.type === "text" ? (
                    <span key={position}>{segment.value}</span>
                  ) : (
                    <sup key={position}>
                      <a
                        href={`#source-${segment.number}`}
                        className="ml-0.5 rounded bg-accent-soft px-1 font-sans text-[11px] font-medium text-accent no-underline"
                      >
                        {segment.number}
                      </a>
                    </sup>
                  ),
                )}
              </p>
            ))}
          </div>
        </>
      ) : (
        <EvidenceBody page={page} />
      )}

      {page.sources.length === 0 && (
        <p className="mt-6 text-muted">The project holds nothing about this yet.</p>
      )}
    </article>
  );
}

function Disposition({ disposition }: { disposition: "abstained" | "clarification_required" }) {
  const text =
    disposition === "abstained"
      ? "The project does not hold enough to answer this. What follows is the closest it has."
      : "The question could be read several ways. The answer below says which reading it took.";
  return <p className="mt-4 rounded border border-rule bg-white px-4 py-3 text-sm text-muted">{text}</p>;
}

/** Without an answerer on the server, the page is the ranked evidence itself. */
function EvidenceBody({ page }: { page: WikiPage }) {
  return (
    <div className="mt-6">
      <p className="mb-6 rounded border border-rule bg-white px-4 py-3 text-sm text-muted">
        This past deployment has no answer model configured, so the wiki shows the evidence it
        found, best match first, instead of a written article.
      </p>
      <div className="space-y-4">
        {page.sources.map((source) => (
          <SourceCard key={source.documentId} source={source} />
        ))}
      </div>
    </div>
  );
}
