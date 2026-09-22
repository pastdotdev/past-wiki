import type { RecallSource } from "@/lib/past/types";
import type { WikiSource } from "@/lib/wiki/page";
import { formatDate } from "@/lib/wiki/format";

interface SourcesProps {
  sources: WikiSource[];
}

/** The right rail of an answered page: cited sources first, then the rest of the recall page. */
export function Sources({ sources }: SourcesProps) {
  const cited = sources.filter((source) => source.cited);
  const rest = sources.filter((source) => !source.cited);
  return (
    <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-1">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted">Sources ({sources.length})</h2>
      <div className="space-y-3">
        {cited.map((source) => (
          <SourceCard key={source.documentId} source={source} />
        ))}
        {cited.length > 0 && rest.length > 0 && (
          <h3 className="pt-3 text-[11px] font-medium uppercase tracking-wider text-muted">Also found</h3>
        )}
        {rest.map((source) => (
          <SourceCard key={source.documentId} source={source} />
        ))}
      </div>
    </div>
  );
}

export function SourceCard({ source }: { source: WikiSource }) {
  return (
    <section
      id={`source-${source.number}`}
      className={`scroll-mt-6 rounded-md border border-rule p-3 text-sm ${source.cited ? "bg-cited" : "bg-white"}`}
    >
      <header className="flex items-baseline gap-2 text-xs text-muted">
        <span className="rounded bg-accent-soft px-1.5 font-medium text-accent">{source.number}</span>
        <span className="capitalize">{source.kind}</span>
        <span>·</span>
        <time dateTime={source.occurredAt}>{formatDate(source.occurredAt)}</time>
      </header>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{source.content}</p>
      {source.sources.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted">
            {source.sources.length === 1 && source.sources[0] ? `From ${sourceTitle(source.sources[0])}` : `From ${source.sources.length} data points`}
          </summary>
          <ul className="mt-2 space-y-2 border-l-2 border-rule pl-3">
            {source.sources.map((origin) => (
              <li key={origin.sourceId}>
                <span className="font-medium">{sourceTitle(origin)}</span>
                <span className="text-muted">
                  {" · "}
                  <time dateTime={origin.occurredAt}>{formatDate(origin.occurredAt)}</time>
                </span>
                {origin.excerpts.map((excerpt, index) => (
                  <p key={index} className="mt-0.5 whitespace-pre-line">
                    {excerpt}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** The data point's `title` metadata when the pusher set one (the seed does), else its id. */
function sourceTitle(origin: RecallSource): string {
  const title = origin.metadata?.title;
  return typeof title === "string" && title.length > 0 ? title : origin.sourceId;
}
