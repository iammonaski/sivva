import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { TutorError } from "@/features/tutor/tutor-error";
import { MAX_ANSWER_CHARACTERS, tutorAnswerSchema, type TutorAnswer, type RetrievedSource } from "@/features/tutor/schemas/tutor";
import type { ConversationMessage } from "@/lib/db/schema/conversations";
import { buildTutorPrompt, TUTOR_SYSTEM_PROMPT } from "./prompts/tutor";
import { geminiClient, GeminiResponseTooLargeError } from "./gemini-client";

export const TUTOR_TIMEOUT_MS = 120_000;

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
  const streamController = new AbortController();
  const timeoutSignal = AbortSignal.timeout(TUTOR_TIMEOUT_MS);
  const combinedSignal = AbortSignal.any([signal, timeoutSignal, streamController.signal]);
  let json = "", emitted = "", stopped = false;
  try {
    combinedSignal.throwIfAborted();
    const stream = await geminiClient.models.generateContentStream({
      model: env.GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: buildTutorPrompt({ question, history, sources }) }] }],
      config: {
        systemInstruction: TUTOR_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(tutorAnswerSchema),
        maxOutputTokens: 8_192,
        httpOptions: { timeout: TUTOR_TIMEOUT_MS },
        abortSignal: combinedSignal,
      },
    });
    for await (const response of stream) {
      combinedSignal.throwIfAborted();
      try {
        if (response.promptFeedback?.blockReason) throw new Error("Blocked output");
        const candidate = response.candidates?.find((item) => item.index === undefined || item.index === 0);
        if (!candidate) continue;
        json += candidate.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
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
          // Abort before the SDK iterator closes: its parser releases the reader
          // lock but does not cancel the underlying HTTP body on an early return.
          streamController.abort();
          break;
        }
      } catch (cause) {
        throw new TutorError("INVALID_OUTPUT", "The tutor response was interrupted or invalid. Please try again.", { cause });
      }
    }
    // The internal controller is aborted at STOP; only caller/timeout aborts fail.
    signal.throwIfAborted();
    timeoutSignal.throwIfAborted();
    if (!stopped) {
      combinedSignal.throwIfAborted();
      throw new TutorError("INVALID_OUTPUT", "The tutor response was interrupted or invalid. Please try again.");
    }
    try {
      const answer = tutorAnswerSchema.parse(JSON.parse(json));
      if (emitted && emitted !== answer.answer) throw new Error("Answer mismatch");
      // JSON key ordering is not a semantic guarantee. Still deliver valid text.
      if (!emitted) yield { type: "delta", text: answer.answer };
      yield { type: "answer", answer };
    } catch (cause) {
      throw new TutorError("INVALID_OUTPUT", "The tutor response was interrupted or invalid. Please try again.", { cause });
    }
  } catch (cause) {
    if (signal.aborted) throw new TutorError("CANCELLED", "The tutor response was cancelled.", { cause });
    if (timeoutSignal.aborted) throw new TutorError("PROVIDER_ERROR", "The tutor response timed out. Please try again.", { cause });
    if (cause instanceof TutorError) throw cause;
    const code = cause instanceof GeminiResponseTooLargeError ? "INVALID_OUTPUT" : "PROVIDER_ERROR";
    throw new TutorError(code, "The tutor could not connect or was interrupted. Please try again.", { cause });
  } finally {
    streamController.abort();
  }
}
