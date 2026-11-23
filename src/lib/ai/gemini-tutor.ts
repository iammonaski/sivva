import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { TutorError } from "@/features/tutor/tutor-error";
import { MAX_ANSWER_CHARACTERS, tutorAnswerSchema, type TutorAnswer, type RetrievedSource } from "@/features/tutor/schemas/tutor";
import type { ConversationMessage } from "@/lib/db/schema/conversations";
import { buildTutorPrompt, TUTOR_SYSTEM_PROMPT } from "./prompts/tutor";

export const TUTOR_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const envelopeSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z.array(z.object({
    index: z.number().optional(), finishReason: z.string().optional(),
    content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }).optional(),
  })).optional(),
});

// Decode only the completed prefix of the answer JSON string. A split escape or
// surrogate pair stays buffered; JSON itself and citations are validated at STOP.
export function readAnswerPrefix(json: string): string {
  const opening = /^\s*\{\s*"answer"\s*:\s*"/.exec(json);
  if (!opening) return "";
  let encoded = "";
  for (let i = opening[0].length; i < json.length; i++) {
    const char = json[i];
    if (char === '"') break;
    if (char === "\\") {
      if (i + 1 >= json.length) break;
      if (json[i + 1] === "u") {
        if (i + 6 > json.length) break;
        encoded += json.slice(i, i + 6);
        i += 5;
      } else { encoded += json.slice(i, i + 2); i++; }
    } else { encoded += char; }
  }
  const decoded: string = JSON.parse(`"${encoded}"`);
  const last = decoded.charCodeAt(decoded.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? decoded.slice(0, -1) : decoded;
}

export type GeminiTutorEvent = { type: "delta"; text: string } | { type: "answer"; answer: TutorAnswer };

export async function* streamTutorAnswer({ question, history, sources, signal }: {
  question: string; history: ConversationMessage[]; sources: RetrievedSource[]; signal: AbortSignal;
}): AsyncGenerator<GeminiTutorEvent> {
  const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(TUTOR_TIMEOUT_MS)]);
  let response: Response;
  try {
    combinedSignal.throwIfAborted();
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
      method: "POST", cache: "no-store", signal: combinedSignal,
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TUTOR_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildTutorPrompt({ question, history, sources }) }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(tutorAnswerSchema), maxOutputTokens: 8_192 },
      }),
    });
  } catch (cause) {
    throw new TutorError(signal.aborted ? "CANCELLED" : "PROVIDER_ERROR", "The tutor could not connect or timed out. Please try again.", { cause });
  }
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    await response.body?.cancel();
    throw new TutorError("PROVIDER_ERROR", "The tutor is temporarily unavailable. Please try again.");
  }
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  combinedSignal.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "", json = "", emitted = "", bytes = 0, stopped = false;
  try {
    while (!stopped) {
      combinedSignal.throwIfAborted();
      const { done, value } = await reader.read();
      combinedSignal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error("Response budget exceeded");
      buffer += decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const envelope = envelopeSchema.parse(JSON.parse(data));
        if (envelope.promptFeedback?.blockReason) throw new Error("Blocked output");
        const candidate = envelope.candidates?.find((item) => item.index === undefined || item.index === 0);
        if (!candidate) continue;
        json += candidate.content?.parts.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
        if (json.length > MAX_ANSWER_CHARACTERS * 8) throw new Error("Output budget exceeded");
        const prefix = readAnswerPrefix(json);
        if (prefix.length > MAX_ANSWER_CHARACTERS || !prefix.startsWith(emitted)) throw new Error("Invalid answer prefix");
        if (prefix.length > emitted.length) {
          yield { type: "delta", text: prefix.slice(emitted.length) };
          emitted = prefix;
        }
        if (candidate.finishReason) {
          if (candidate.finishReason !== "STOP") throw new Error("Incomplete output");
          stopped = true;
          break;
        }
      }
    }
    combinedSignal.throwIfAborted();
    if (!stopped) throw new Error("Incomplete stream");
    const answer = tutorAnswerSchema.parse(JSON.parse(json));
    if (emitted && emitted !== answer.answer) throw new Error("Answer mismatch");
    // JSON object key ordering isn't a semantic guarantee. If the provider
    // ignored the answer-first instruction, still deliver its validated text.
    if (!emitted) yield { type: "delta", text: answer.answer };
    yield { type: "answer", answer };
  } catch (cause) {
    const code = signal.aborted ? "CANCELLED" : combinedSignal.aborted ? "PROVIDER_ERROR" : "INVALID_OUTPUT";
    throw new TutorError(code, "The tutor response was interrupted or invalid. Please try again.", { cause });
  } finally {
    combinedSignal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
