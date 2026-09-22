/**
 * The questions this browser has asked, newest first. Kept in localStorage: the wiki has no
 * database, and a reader's trail is theirs alone.
 */

export interface HistoryEntry {
  question: string;
  askedAt: string;
}

const KEY = "past-wiki:history";
const LIMIT = 50;

export function readHistory(storage: Storage | null): HistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function remember(storage: Storage | null, entry: HistoryEntry): HistoryEntry[] {
  const without = readHistory(storage).filter((existing) => existing.question !== entry.question);
  return write(storage, [entry, ...without].slice(0, LIMIT));
}

export function forget(storage: Storage | null, question: string): HistoryEntry[] {
  return write(storage, readHistory(storage).filter((existing) => existing.question !== question));
}

function write(storage: Storage | null, next: HistoryEntry[]): HistoryEntry[] {
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the list still renders for this session.
  }
  notify();
  return next;
}

function isEntry(value: unknown): value is HistoryEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HistoryEntry).question === "string" &&
    typeof (value as HistoryEntry).askedAt === "string"
  );
}

// A tiny external store so React reads history through useSyncExternalStore: writes from this
// tab notify directly, writes from another tab arrive as "storage" events.

const listeners = new Set<() => void>();
const EMPTY: HistoryEntry[] = [];
let cachedRaw: string | null = null;
let cachedList: HistoryEntry[] = EMPTY;

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Referentially stable while the stored text is unchanged, as useSyncExternalStore requires. */
export function historySnapshot(): HistoryEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = readHistory(window.localStorage);
  }
  return cachedList;
}

export function historyServerSnapshot(): HistoryEntry[] {
  return EMPTY;
}
