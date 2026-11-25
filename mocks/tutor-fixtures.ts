import type { RetrievedSource, TutorAnswer, TutorEvent } from "@/features/tutor/schemas/tutor";
import { FinishReason, GenerateContentResponse } from "@google/genai";

export function createTutorSources(): RetrievedSource[] {
  return [{ chunkId: "11111111-1111-4111-8111-111111111111", content: "Photosynthesis converts light into chemical energy.", pageNumber: 2, sectionHeading: null },
    { chunkId: "22222222-2222-4222-8222-222222222222", content: "Chlorophyll absorbs light.", pageNumber: null, sectionHeading: "Chlorophyll" }];
}
export function createTutorAnswer(overrides: Partial<TutorAnswer> = {}): TutorAnswer {
  return { answer: "Photosynthesis converts light into chemical energy [S1].", sourceIds: ["S1"], grounding: "source-grounded", ...overrides };
}
export function createTutorChunks({ pieces, finishReason = FinishReason.STOP }: {
  pieces?: string[]; finishReason?: FinishReason;
} = {}): GenerateContentResponse[] {
  const text = JSON.stringify(createTutorAnswer());
  const parts = pieces ?? [text.slice(0, 30), text.slice(30)];
  return parts.map((part, index) => Object.assign(new GenerateContentResponse(), {
    candidates: [{ index: 0, content: { parts: [{ text: part }] },
      ...(index === parts.length - 1 ? { finishReason } : {}),
    }],
  }));
}
export function createBrowserTutorDone(): Extract<TutorEvent, { type: "done" }> {
  return { type: "done", conversationId: "33333333-3333-4333-8333-333333333333", message: {
    id: "44444444-4444-4444-8444-444444444444", role: "assistant", content: "Chlorophyll absorbs light 🌿 [S1].",
    grounding: "source-grounded", citations: [{ sourceId: "S1", chunkId: "11111111-1111-4111-8111-111111111111", pageNumber: 2, text: "Chlorophyll absorbs light." }],
    createdAt: "2026-11-23T00:00:00.000Z",
  } };
}
export function createBrowserTutorSse(events: TutorEvent[], crlf = false) {
  const nl = crlf ? "\r\n" : "\n";
  return events.map((event) => `event: ${event.type}${nl}data: ${JSON.stringify(event)}${nl}${nl}`).join("");
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
