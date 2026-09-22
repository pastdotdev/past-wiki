"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { forget, historyServerSnapshot, historySnapshot, remember, subscribeHistory } from "@/lib/wiki/history";
import type { WikiPage } from "@/lib/wiki/page";
import { Article } from "./Article";
import { AskBar } from "./AskBar";
import { Sidebar } from "./Sidebar";
import { Sources } from "./Sources";

interface WikiProps {
  title: string;
}

interface Failure {
  question: string;
  message: string;
}

/**
 * The whole wiki is one screen: ask, read, follow the sources. The question lives in the URL
 * (`?q=`) so a page can be linked, and the browser keeps its own trail of what it asked.
 *
 * Everything shown is derived from the URL plus the last page or failure received: a page is
 * loading exactly when the URL asks for a question nobody has answered or failed yet.
 */
export function Wiki({ title }: WikiProps) {
  const router = useRouter();
  const params = useSearchParams();
  const question = params.get("q")?.trim() ?? "";

  const [page, setPage] = useState<WikiPage | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const history = useSyncExternalStore(subscribeHistory, historySnapshot, historyServerSnapshot);
  const inflight = useRef<AbortController | null>(null);

  const current = page?.question === question ? page : null;
  const error = failure?.question === question ? failure.message : null;
  const loading = question.length > 0 && current === null && error === null;

  useEffect(() => {
    if (!loading) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;

    void (async () => {
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
        const body = (await response.json()) as WikiPage | { error: string };
        if (controller.signal.aborted) return;
        if (!response.ok || "error" in body) {
          setFailure({ question, message: "error" in body ? body.error : `Request failed (${response.status}).` });
          return;
        }
        setPage(body);
        remember(window.localStorage, { question, askedAt: body.askedAt });
      } catch (caught) {
        if (controller.signal.aborted) return;
        setFailure({ question, message: caught instanceof Error ? caught.message : "Request failed." });
      }
    })();

    return () => controller.abort();
  }, [question, loading]);

  const navigate = (next: string) => {
    const trimmed = next.trim();
    if (trimmed.length === 0) return;
    if (trimmed === question) setFailure(null); // Asking the same thing again retries it.
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        title={title}
        history={history}
        current={question}
        onSelect={navigate}
        onForget={(entry) => forget(window.localStorage, entry)}
        onHome={() => router.push("/")}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-rule bg-paper/95 px-8 py-4 backdrop-blur">
          <AskBar key={question} initial={question} busy={loading} onAsk={navigate} />
        </header>
        <div className="flex flex-1 gap-10 px-8 py-8">
          <div className="min-w-0 flex-1">
            {error !== null && (
              <p role="alert" className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </p>
            )}
            {loading && <p className="text-sm text-muted">Reading what the project remembers about “{question}”…</p>}
            {current && <Article page={current} />}
            {question.length === 0 && <Welcome />}
          </div>
          {current && current.mode === "answer" && current.sources.length > 0 && (
            <aside className="hidden w-[22rem] shrink-0 lg:block">
              <Sources sources={current.sources} />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function Welcome() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Ask the project anything.</h1>
      <p className="mt-3 text-muted">
        Every page here is a question. Type one above and the wiki writes the article from what
        the project remembers, with every claim linked to the dated source it came from.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-muted">
        <li>“What did we decide about pricing?”</li>
        <li>“Who owns the onboarding flow?”</li>
        <li>“What changed in the Acme pilot last month?”</li>
      </ul>
    </div>
  );
}
