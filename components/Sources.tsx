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
        {source.confidence !== null && (
          <span className="ml-auto" title="Relevance to the question">
            {Math.round(source.confidence * 100)}%
          </span>
        )}
      </header>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{source.content}</p>
      {source.attributes && Object.keys(source.attributes).length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
          {Object.entries(source.attributes).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="font-medium">{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {source.excerpts.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted">
            {source.excerpts.length === 1 ? "Original excerpt" : `${source.excerpts.length} original excerpts`}
          </summary>
          <ul className="mt-2 space-y-2 border-l-2 border-rule pl-3">
            {source.excerpts.map((excerpt, index) => (
              <li key={index}>
                <time dateTime={excerpt.occurredAt} className="text-muted">
                  {formatDate(excerpt.occurredAt)}
                </time>
                <p className="mt-0.5 whitespace-pre-line">{excerpt.content}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
