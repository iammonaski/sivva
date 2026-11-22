import { z } from "zod";

const shortText = z.string().trim().min(1).max(200);
const explanation = z.string().trim().min(1).max(2_000);

export const topicsSchema = z.array(z.strictObject({
  title: shortText,
  summary: explanation,
})).min(1).max(30);

export const studyGuideSchema = z.strictObject({
  overview: z.string().trim().min(1).max(12_000),
  keyConcepts: z.array(z.strictObject({
    term: shortText,
    definition: explanation,
  })).max(40),
  // Keep the existing glossary contract: terms, with explanations in keyConcepts.
  keyTerms: z.array(shortText).max(60),
});

export const analysisSchema = z.strictObject({
  topics: topicsSchema,
  studyGuide: studyGuideSchema,
});

export type DocumentAnalysis = z.infer<typeof analysisSchema>;
