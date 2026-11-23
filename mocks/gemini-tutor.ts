import { vi } from "vitest";
import type { GeminiTutorEvent, streamTutorAnswer } from "@/lib/ai/gemini-tutor";

const tutorProvider = vi.hoisted(() => ({ streamTutorAnswer: vi.fn<typeof streamTutorAnswer>() }));
export { tutorProvider };
vi.mock("@/lib/ai/gemini-tutor", () => ({ streamTutorAnswer: tutorProvider.streamTutorAnswer }));
export function resetTutorProvider() {
  tutorProvider.streamTutorAnswer.mockReset();
  tutorProvider.streamTutorAnswer.mockImplementation(async function* (): AsyncGenerator<GeminiTutorEvent> {
    const answer = { answer: "Photosynthesis converts light into chemical energy [S1].", sourceIds: ["S1"], grounding: "source-grounded" as const };
    yield { type: "delta", text: answer.answer };
    yield { type: "answer", answer };
  });
}
