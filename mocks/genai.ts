import { vi } from "vitest";
import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAIOptions } from "@google/genai";

const genai = vi.hoisted(() => ({
  configure: vi.fn<(options: GoogleGenAIOptions) => void>(),
  models: {
    generateContent: vi.fn<(params: GenerateContentParameters) => Promise<GenerateContentResponse>>(),
    generateContentStream: vi.fn<(params: GenerateContentParameters) => Promise<AsyncGenerator<GenerateContentResponse>>>(),
  },
}));
export { genai };

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return { ...actual, GoogleGenAI: class {
    models = genai.models;
    constructor(options: GoogleGenAIOptions) { genai.configure(options); }
  } };
});

export function resetGenai() {
  genai.models.generateContent.mockReset();
  genai.models.generateContentStream.mockReset();
}

export async function* createGenaiStream(chunks: GenerateContentResponse[]) {
  yield* chunks;
}

export function controlGeminiTimeout() {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  return { controller, timeout };
}
