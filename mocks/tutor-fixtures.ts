import type { RetrievedSource, TutorAnswer } from "@/features/tutor/schemas/tutor";

export function createTutorSources(): RetrievedSource[] {
  return [{ chunkId: "11111111-1111-4111-8111-111111111111", content: "Photosynthesis converts light into chemical energy.", pageNumber: 2, sectionHeading: null },
    { chunkId: "22222222-2222-4222-8222-222222222222", content: "Chlorophyll absorbs light.", pageNumber: null, sectionHeading: "Chlorophyll" }];
}
export function createTutorAnswer(overrides: Partial<TutorAnswer> = {}): TutorAnswer {
  return { answer: "Photosynthesis converts light into chemical energy [S1].", sourceIds: ["S1"], grounding: "source-grounded", ...overrides };
}
export function createTutorSse({ pieces, finishReason = "STOP", crlf = false }: {
  pieces?: string[]; finishReason?: string; crlf?: boolean;
} = {}) {
  const nl = crlf ? "\r\n" : "\n";
  const text = JSON.stringify(createTutorAnswer());
  const parts = pieces ?? [text.slice(0, 30), text.slice(30)];
  return parts.map((part, index) => `data: ${JSON.stringify({ candidates: [{ index: 0,
    content: { parts: [{ text: part }] }, ...(index === parts.length - 1 ? { finishReason } : {}),
  }] })}${nl}${nl}`).join("");
}
export function splitSseResponse(text: string, width = 7) {
  const bytes = new TextEncoder().encode(text);
  let index = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= bytes.length) controller.close();
      else { controller.enqueue(bytes.slice(index, index + width)); index += width; }
    },
  }), { headers: { "Content-Type": "text/event-stream" } });
}
