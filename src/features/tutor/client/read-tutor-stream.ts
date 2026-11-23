import { z } from "zod";
import { MAX_ANSWER_CHARACTERS, tutorEventSchema, type TutorEvent } from "../schemas/tutor";

const errorSchema = z.object({ error: z.string(), code: z.string().optional() });
type CompletedTurn = Extract<TutorEvent, { type: "done" }>;

export async function readTutorStream({
  response, onDelta, signal,
}: {
  response: Response;
  onDelta: (text: string) => void;
  signal: AbortSignal;
}): Promise<CompletedTurn> {
  if (!response.ok) {
    const result = errorSchema.safeParse(await response.json().catch(() => null));
    throw new Error(result.success ? result.data.error : "The tutor request failed. Reload history before trying again.");
  }
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("The tutor response was interrupted. Reload history before trying again.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalBytes = 0;
  let answerLength = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
      const { value, done } = await reader.read();
      if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
      totalBytes += value?.byteLength ?? 0;
      if (totalBytes > 2_000_000) throw new Error("The tutor response exceeded its limit. Reload history before trying again.");
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const lines = frame.split(/\r?\n/);
        const name = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const event = tutorEventSchema.parse(JSON.parse(data));
        if (name !== event.type) throw new Error("The tutor returned an invalid event.");
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "done") {
          if (event.message.role !== "assistant") throw new Error("The tutor returned an invalid answer.");
          return event;
        }
        answerLength += event.text.length;
        if (answerLength > MAX_ANSWER_CHARACTERS) throw new Error("The tutor answer exceeded its limit.");
        onDelta(event.text);
      }
      if (done) throw new Error("The response ended before confirmation. Reload history before trying again.");
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
