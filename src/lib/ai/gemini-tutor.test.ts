import { resetGenai, genai, createGenaiStream, controlGeminiTimeout } from "../../../mocks/genai";
import { createTutorAnswer, createTutorSources, createTutorChunks } from "../../../mocks/tutor-fixtures";
import { ApiError, BlockedReason, FinishReason, GenerateContentResponse } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAnswerPrefix, streamTutorAnswer, TUTOR_TIMEOUT_MS } from "./gemini-tutor";
import { MAX_ANSWER_CHARACTERS } from "@/features/tutor/schemas/tutor";
import { TUTOR_SYSTEM_PROMPT } from "./prompts/tutor";
import { GeminiResponseTooLargeError } from "./gemini-client";

beforeEach(resetGenai);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const input = () => ({ question: "What is photosynthesis?", history: [], sources: createTutorSources(), signal: new AbortController().signal });
async function collect() { return Array.fromAsync(streamTutorAnswer(input())); }

describe("Gemini tutor SDK streaming", () => {
  it("returns actual deltas then validated JSON with the configured prompts and schema", async () => {
    genai.models.generateContentStream.mockResolvedValue(createGenaiStream(createTutorChunks()));
    const events = await collect();
    expect(events.filter((event) => event.type === "delta").map((event) => event.text).join("")).toBe(createTutorAnswer().answer);
    expect(events.at(-1)).toEqual({ type: "answer", answer: createTutorAnswer() });
    const request = genai.models.generateContentStream.mock.calls[0][0];
    expect(request.model).toMatch(/^gemini-/);
    expect(request.config).toMatchObject({ systemInstruction: TUTOR_SYSTEM_PROMPT,
      responseMimeType: "application/json", responseJsonSchema: { type: "object", required: ["answer", "sourceIds", "grounding"] },
      maxOutputTokens: 8_192, httpOptions: { timeout: TUTOR_TIMEOUT_MS }, abortSignal: expect.any(AbortSignal),
    });
    expect(JSON.stringify(request.contents)).toContain("S1");
  });
  it("emits before provider completion and aborts when the consumer returns early", async () => {
    const text = JSON.stringify(createTutorAnswer());
    const stream = createGenaiStream(createTutorChunks({ pieces: [text.slice(0, 35), text.slice(35)] }));
    const next = vi.spyOn(stream, "next");
    genai.models.generateContentStream.mockResolvedValue(stream);
    const iterator = streamTutorAnswer(input());
    expect((await iterator.next()).value).toMatchObject({ type: "delta", text: expect.stringContaining("Photosynthesis") });
    expect(next).toHaveBeenCalledTimes(1);
    const signal = genai.models.generateContentStream.mock.calls[0][0].config?.abortSignal;
    expect(signal?.aborted).toBe(false);
    await iterator.return(undefined);
    expect(signal?.aborted).toBe(true);
  });
  it("ignores thought parts and non-primary candidates", async () => {
    const answer = createTutorAnswer({ answer: 'Light → energy 🌿\n"quoted" [S1].' });
    const chunk = Object.assign(new GenerateContentResponse(), { candidates: [
      { index: 1, finishReason: FinishReason.SAFETY },
      { index: 0, content: { parts: [{ text: "private", thought: true }, { text: JSON.stringify(answer) }] }, finishReason: FinishReason.STOP },
    ] });
    genai.models.generateContentStream.mockResolvedValue(createGenaiStream([chunk]));
    const events = await collect();
    expect(events.at(-1)).toEqual({ type: "answer", answer });
    expect(JSON.stringify(events)).not.toContain("private");
  });
  it.each([FinishReason.MAX_TOKENS, FinishReason.SAFETY, FinishReason.RECITATION])("rejects %s terminal output", async (finishReason) => {
    genai.models.generateContentStream.mockResolvedValue(createGenaiStream(createTutorChunks({ finishReason })));
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it.each([
    [new GenerateContentResponse()],
    [Object.assign(new GenerateContentResponse(), { promptFeedback: { blockReason: BlockedReason.SAFETY } })],
    createTutorChunks({ pieces: ['{"answer":"bad"}'] }),
    createTutorChunks({ pieces: ["not JSON"] }),
    createTutorChunks({ pieces: [JSON.stringify(createTutorAnswer({ answer: "x".repeat(MAX_ANSWER_CHARACTERS + 1) }))] }),
    createTutorChunks({ pieces: ["x".repeat(MAX_ANSWER_CHARACTERS * 8 + 1)] }),
  ].map((chunks) => ({ chunks })))("rejects incomplete, blocked, schema-invalid or oversized output: %#", async ({ chunks }) => {
    genai.models.generateContentStream.mockResolvedValue(createGenaiStream(chunks));
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("requires STOP even when the accumulated JSON is valid", async () => {
    const chunks = createTutorChunks();
    delete chunks.at(-1)!.candidates![0].finishReason;
    genai.models.generateContentStream.mockResolvedValue(createGenaiStream(chunks));
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("still delivers answer text when JSON keys are reordered", async () => {
    const answer = createTutorAnswer();
    genai.models.generateContentStream.mockResolvedValue(createGenaiStream(createTutorChunks({ pieces: [JSON.stringify({ sourceIds: answer.sourceIds, grounding: answer.grounding, answer: answer.answer })] })));
    expect(await collect()).toEqual([{ type: "delta", text: answer.answer }, { type: "answer", answer }]);
  });
  it("rejects a final answer that differs from its streamed prefix", async () => {
    // Duplicate JSON keys are accepted by JSON.parse, but must not replace text
    // that has already been streamed to the user.
    genai.models.generateContentStream.mockResolvedValue(createGenaiStream(createTutorChunks({ pieces: ['{"answer":"first","answer":"changed","sourceIds":[],"grounding":"unsupported"}'] })));
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it.each([401, 429, 500])("sanitizes SDK API %s failures", async (status) => {
    genai.models.generateContentStream.mockRejectedValue(new ApiError({ status, message: "private API key" }));
    await expect(collect()).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
    expect(genai.models.generateContentStream).toHaveBeenCalledTimes(1);
  });
  it("maps SDK failures after a delta without retrying or yielding a final answer", async () => {
    genai.models.generateContentStream.mockResolvedValue((async function* () {
      yield createTutorChunks()[0];
      throw new ApiError({ status: 500, message: "private content" });
    })());
    const iterator = streamTutorAnswer(input());
    expect((await iterator.next()).value?.type).toBe("delta");
    await expect(iterator.next()).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
    expect(genai.models.generateContentStream).toHaveBeenCalledTimes(1);
  });
  it("maps the byte guard to invalid output", async () => {
    genai.models.generateContentStream.mockRejectedValue(new GeminiResponseTooLargeError());
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("cancels a stalled SDK request on caller abort", async () => {
    const controller = new AbortController();
    genai.models.generateContentStream.mockImplementation(({ config }) => new Promise((_resolve, reject) => config?.abortSignal?.addEventListener("abort", () => reject(new Error("private")))));
    const assertion = expect(Array.fromAsync(streamTutorAnswer({ ...input(), signal: controller.signal }))).rejects.toMatchObject({ code: "CANCELLED" });
    controller.abort();
    await assertion;
  });
  it("rejects an already-cancelled request without invoking the SDK", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(Array.fromAsync(streamTutorAnswer({ ...input(), signal: controller.signal }))).rejects.toMatchObject({ code: "CANCELLED" });
    expect(genai.models.generateContentStream).not.toHaveBeenCalled();
  });
  it("cancels a stalled SDK stream on timeout", async () => {
    const { controller, timeout } = controlGeminiTimeout();
    genai.models.generateContentStream.mockImplementation(async ({ config }) => (async function* () {
      await new Promise((_resolve, reject) => config?.abortSignal?.addEventListener("abort", () => reject(config.abortSignal?.reason)));
      yield new GenerateContentResponse();
    })());
    const iterator = streamTutorAnswer(input());
    const pending = iterator.next();
    await Promise.resolve(); await Promise.resolve();
    expect(timeout).toHaveBeenCalledWith(TUTOR_TIMEOUT_MS);
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    await expect(pending).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });
});

describe("incremental answer string", () => {
  it("buffers split escapes and surrogate pairs", () => {
    expect(readAnswerPrefix('{"answer":"a\\')).toBe("a");
    expect(readAnswerPrefix('{"answer":"a\\uD83C')).toBe("a");
    expect(readAnswerPrefix('{"answer":"a\\uD83C\\uDF3F')).toBe("a🌿");
    expect(readAnswerPrefix('{"answer":"a\\n')).toBe("a\n");
    expect(readAnswerPrefix('{"sourceIds":[]')).toBe("");
  });
});
