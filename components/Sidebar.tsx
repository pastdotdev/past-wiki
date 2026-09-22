"use client";

import type { HistoryEntry } from "@/lib/wiki/history";

interface SidebarProps {
  title: string;
  history: HistoryEntry[];
  current: string;
  onSelect: (question: string) => void;
  onForget: (question: string) => void;
  onHome: () => void;
}

export function Sidebar({ title, history, current, onSelect, onForget, onHome }: SidebarProps) {
  return (
    <nav className="hidden w-64 shrink-0 flex-col border-r border-rule bg-white/60 md:flex">
      <button
        type="button"
        onClick={onHome}
        className="px-5 py-4 text-left text-base font-semibold tracking-tight hover:text-accent"
      >
        {title}
      </button>
      <div className="px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
        Pages you asked for
      </div>
      {history.length === 0 ? (
        <p className="px-5 text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {history.map((entry) => {
            const active = entry.question === current;
            return (
              <li key={entry.question} className="group flex items-start">
                <button
                  type="button"
                  onClick={() => onSelect(entry.question)}
                  className={`flex-1 truncate px-5 py-1.5 text-left text-sm ${
                    active ? "bg-accent-soft text-accent" : "hover:bg-accent-soft/60"
                  }`}
                  title={entry.question}
                >
                  {entry.question}
                </button>
                <button
                  type="button"
                  onClick={() => onForget(entry.question)}
                  aria-label={`Forget “${entry.question}”`}
                  className="px-2 py-1.5 text-xs text-muted opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <footer className="px-5 py-4 text-xs text-muted">
        Powered by{" "}
        <a href="https://past.dev" className="underline hover:text-accent">
          past
        </a>
      </footer>
    </nav>
  );
}
