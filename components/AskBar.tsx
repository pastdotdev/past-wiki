"use client";

import { useState, type FormEvent } from "react";

interface AskBarProps {
  initial: string;
  busy: boolean;
  onAsk: (question: string) => void;
}

export function AskBar({ initial, busy, onAsk }: AskBarProps) {
  const [value, setValue] = useState(initial);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAsk(value);
  };

  return (
    <form onSubmit={submit} className="flex max-w-3xl items-center gap-3">
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask a question…"
        autoComplete="off"
        autoFocus
        aria-label="Question"
        className="flex-1 rounded-md border border-rule bg-white px-4 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
      <button
        type="submit"
        disabled={busy || value.trim().length === 0}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "Asking…" : "Ask"}
      </button>
    </form>
  );
}
