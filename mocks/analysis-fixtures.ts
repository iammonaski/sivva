import type { DocumentAnalysis } from "@/lib/ai/schemas/document-analysis";
import { FinishReason, BlockedReason, GenerateContentResponse } from "@google/genai";

export function createAnalysis(): DocumentAnalysis {
  return {
    topics: [
      { title: "Photosynthesis", summary: "Light is converted into chemical energy." },
      { title: "Chlorophyll", summary: "Chlorophyll absorbs light." },
    ],
    studyGuide: {
      overview: "The lecture covers photosynthesis and the role of chlorophyll.",
      keyConcepts: [{ term: "Photosynthesis", definition: "Conversion of light into chemical energy." }],
      keyTerms: ["Photosynthesis", "Chlorophyll"],
    },
  };
}

export function createGeminiResponse({
  output = createAnalysis(), finishReason = FinishReason.STOP, blockReason,
}: { output?: unknown; finishReason?: FinishReason; blockReason?: BlockedReason } = {}) {
  return Object.assign(new GenerateContentResponse(), {
    ...(blockReason ? { promptFeedback: { blockReason } } : {}),
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(output) }] } }],
  });
}
