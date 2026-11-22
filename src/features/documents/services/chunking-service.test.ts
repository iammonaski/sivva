import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { documentFixtures } from "../../../../mocks/document-fixtures";
import { chunkDocument, normalizeText } from "./chunking-service";

function chunkText(text: string, options: { maxTokens: number; overlapTokens: number }) {
  return chunkDocument({ sections: [{ text, pageNumber: 1, sectionHeading: null }], ...options });
}

describe("normalizeText", () => {
  it("normalizes Unicode, NULs, horizontal whitespace, line endings, and excessive blank lines", () => {
    const { input, expected } = documentFixtures.normalization;
    expect(normalizeText(input)).toBe(expected);
    expect(normalizeText(expected)).toBe(expected);
  });

  it("returns no text for a whitespace-only section", () => {
    expect(normalizeText(documentFixtures.sectionBoundaries[1].text)).toBe("");
  });
});

describe("chunkDocument", () => {
  it("preserves global chunk order and never crosses a page or heading boundary", () => {
    const chunks = chunkDocument({ sections: documentFixtures.sectionBoundaries, maxTokens: 5, overlapTokens: 1 });
    expect(chunks.map(({ chunkIndex }) => chunkIndex)).toEqual(chunks.map((_, index) => index));
    expect(chunks.map(({ pageNumber }) => pageNumber)).toEqual([1, 1, 1, 3, 3, 3, null, null, null, null, null, null]);
    for (const chunk of chunks) {
      const source = documentFixtures.sectionBoundaries.find((section) => section.pageNumber === chunk.pageNumber && section.sectionHeading === chunk.sectionHeading);
      expect(source).toBeDefined();
      expect(source!.text).toContain(chunk.text);
      expect(chunk.text).toMatch(/^(a+|b+|c+|d+)$/);
      expect(Array.from(chunk.text).length).toBeLessThanOrEqual(20);
      expect(chunk.tokenCount).toBe(Math.ceil(Array.from(chunk.text).length / 4));
    }
  });

  it("includes configured overlap without dropping or reordering source characters", () => {
    const text = documentFixtures.overlapText;
    const chunks = chunkText(text, { maxTokens: 5, overlapTokens: 1 });
    expect(chunks.map(({ text: content }) => content)).toEqual([
      text.slice(0, 20), text.slice(16, 36), text.slice(32, 52), text.slice(48),
    ]);
    expect(chunks[0].text + chunks.slice(1).map(({ text: content }) => content.slice(4)).join("")).toBe(text);
  });

  it("prefers a nearby word boundary rather than breaking a word", () => {
    const text = documentFixtures.boundaryText;
    const chunks = chunkText(text, { maxTokens: 5, overlapTokens: 0 });
    expect(chunks[0].text).toBe("alpha beta gamma");
    expect(chunks.map(({ text: content }) => content).join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
    expect(chunks.every(({ text: content }) => Array.from(content).length <= 20)).toBe(true);
  });

  it("splits a very large single word with bounded chunks and makes progress", () => {
    const text = documentFixtures.largeWord;
    const chunks = chunkText(text, { maxTokens: 7, overlapTokens: 0 });
    expect(chunks).toHaveLength(Math.ceil(text.length / 28));
    expect(chunks.map(({ text: content }) => content).join("")).toBe(text);
    expect(chunks.every(({ text: content, tokenCount }) => content.length <= 28 && tokenCount <= 7)).toBe(true);
  });

  it("counts Unicode code points rather than UTF-16 units and never splits surrogate pairs", () => {
    const text = documentFixtures.unicodeText;
    const chunks = chunkText(text, { maxTokens: 3, overlapTokens: 0 });
    expect(chunks.map(({ text: content }) => content).join("")).toBe(text);
    expect(chunks[0].tokenCount).toBe(3);
    for (const chunk of chunks) {
      expect(Array.from(chunk.text).length).toBeLessThanOrEqual(12);
      expect(chunk.tokenCount).toBe(Math.ceil(Array.from(chunk.text).length / 4));
      expect(chunk.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
    }
  });

  it("normalizes text before chunking and estimating tokens", () => {
    const text = documentFixtures.unicodeNormalized;
    const chunks = chunkText(text, { maxTokens: 4, overlapTokens: 0 });
    expect(chunks.map(({ text: content }) => content).join("")).toBe(normalizeText(text));
    expect(chunks.every(({ text: content }) => content === content.normalize("NFC"))).toBe(true);
  });

  it("uses bounded defaults and skips empty sections without creating empty chunks", () => {
    expect(chunkDocument({ sections: [] })).toEqual([]);
    expect(chunkDocument({ sections: [documentFixtures.sectionBoundaries[1]] })).toEqual([]);
    const chunks = chunkDocument({ sections: [{ text: documentFixtures.largeWord, pageNumber: 1, sectionHeading: null }] });
    expect(chunks[0].text).toHaveLength(3000);
    expect(chunks.every(({ tokenCount }) => tokenCount <= 750)).toBe(true);
    expect(chunks[0].text + chunks.slice(1).map(({ text }) => text.slice(400)).join("")).toBe(documentFixtures.largeWord);
  });

  it.each([
    { maxTokens: 5, overlapTokens: 5 },
    { maxTokens: 5, overlapTokens: 6 },
    { maxTokens: 5, overlapTokens: -1 },
    { maxTokens: 5, overlapTokens: 0.5 },
    { maxTokens: 0, overlapTokens: 0 },
    { maxTokens: 1001, overlapTokens: 0 },
    { maxTokens: 1.5, overlapTokens: 0 },
  ])("rejects invalid chunk options %j", (options) => {
    expect(() => chunkDocument({ sections: [], ...options })).toThrow(ZodError);
  });
});
