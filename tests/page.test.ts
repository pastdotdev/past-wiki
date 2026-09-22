import { describe, expect, it } from "vitest";
import { paragraphs, segmentParagraph } from "@/lib/wiki/page";

describe("segmentParagraph", () => {
  const known = new Set([1, 2, 12]);

  it("turns dN tokens into citation markers", () => {
    expect(segmentParagraph("The budget is 40k d1. It was approved in June d2.", known)).toEqual([
      { type: "text", value: "The budget is 40k " },
      { type: "citation", number: 1 },
      { type: "text", value: ". It was approved in June " },
      { type: "citation", number: 2 },
      { type: "text", value: "." },
    ]);
  });

  it("leaves tokens that match no source as plain text", () => {
    expect(segmentParagraph("Unclear d7 here.", known)).toEqual([{ type: "text", value: "Unclear d7 here." }]);
  });

  it("does not match inside words or identifiers", () => {
    expect(segmentParagraph("build1 and d12x and d0", known)).toEqual([{ type: "text", value: "build1 and d12x and d0" }]);
  });

  it("reads multi-digit ranks and uppercase markers", () => {
    expect(segmentParagraph("See D12", known)).toEqual([
      { type: "text", value: "See " },
      { type: "citation", number: 12 },
    ]);
  });
});

describe("paragraphs", () => {
  it("splits on blank lines and drops empties", () => {
    expect(paragraphs("First.\n\n\nSecond line\ncontinues.\n\n  \n")).toEqual(["First.", "Second line\ncontinues."]);
  });
});
