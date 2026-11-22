import { vi } from "vitest";
import { createAnalysis } from "./analysis-fixtures";

const gemini = vi.hoisted(() => ({ generateDocumentAnalysis: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ generateDocumentAnalysis: gemini.generateDocumentAnalysis }));
export function resetGemini() {
  gemini.generateDocumentAnalysis.mockReset().mockResolvedValue(createAnalysis());
}
export { gemini };
