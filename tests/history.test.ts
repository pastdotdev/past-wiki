import { describe, expect, it } from "vitest";
import { forget, readHistory, remember } from "@/lib/wiki/history";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("history", () => {
  it("keeps newest first and dedupes by question", () => {
    const storage = memoryStorage();
    remember(storage, { question: "a", askedAt: "1" });
    remember(storage, { question: "b", askedAt: "2" });
    const list = remember(storage, { question: "a", askedAt: "3" });
    expect(list).toEqual([
      { question: "a", askedAt: "3" },
      { question: "b", askedAt: "2" },
    ]);
    expect(readHistory(storage)).toEqual(list);
  });

  it("forgets one question", () => {
    const storage = memoryStorage();
    remember(storage, { question: "a", askedAt: "1" });
    remember(storage, { question: "b", askedAt: "2" });
    expect(forget(storage, "a")).toEqual([{ question: "b", askedAt: "2" }]);
  });

  it("ignores garbage in storage and a missing storage", () => {
    const storage = memoryStorage();
    storage.setItem("past-wiki:history", "{not json");
    expect(readHistory(storage)).toEqual([]);
    storage.setItem("past-wiki:history", JSON.stringify([{ question: 1 }, { question: "ok", askedAt: "1" }]));
    expect(readHistory(storage)).toEqual([{ question: "ok", askedAt: "1" }]);
    expect(readHistory(null)).toEqual([]);
  });
});
