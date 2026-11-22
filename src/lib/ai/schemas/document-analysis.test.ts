import { describe, expect, it } from "vitest";
import { createAnalysis } from "../../../../mocks/analysis-fixtures";
import { analysisSchema, studyGuideSchema, topicsSchema } from "./document-analysis";

describe("document analysis validation", () => {
  it("accepts a complete typed analysis and trims strings", () => {
    const analysis = createAnalysis();
    analysis.topics[0].title = "  Photosynthesis  ";
    expect(analysisSchema.parse(analysis).topics[0].title).toBe("Photosynthesis");
  });
  it("allows sparse source material without invented concepts or terms", () => {
    const guide = { ...createAnalysis().studyGuide, keyConcepts: [], keyTerms: [] };
    expect(studyGuideSchema.parse(guide)).toEqual(guide);
  });
  it.each([
    {}, { topics: [], studyGuide: createAnalysis().studyGuide },
    { ...createAnalysis(), topics: [{ title: " ", summary: "Summary" }] },
    { ...createAnalysis(), studyGuide: { ...createAnalysis().studyGuide, keyTerms: [123] } },
    { ...createAnalysis(), unexpected: "Injected field" },
    { ...createAnalysis(), studyGuide: { ...createAnalysis().studyGuide, overview: "x".repeat(12_001) } },
    { ...createAnalysis(), studyGuide: { ...createAnalysis().studyGuide, keyConcepts: [{ term: "Term" }] } },
  ])("rejects invalid or unexpected fields: %#", (output) => {
    expect(analysisSchema.safeParse(output).success).toBe(false);
  });
  it("caps topic count and summary length", () => {
    const topic = createAnalysis().topics[0];
    expect(topicsSchema.safeParse(Array(31).fill(topic)).success).toBe(false);
    expect(topicsSchema.safeParse([{ ...topic, summary: "x".repeat(2_001) }]).success).toBe(false);
  });
});
