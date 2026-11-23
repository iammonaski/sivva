import { installGeminiFetch, geminiFetch, controlGeminiTimeout } from "../../../mocks/gemini-http";
import { createTutorAnswer, createTutorSources, createTutorSse, splitSseResponse } from "../../../mocks/tutor-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAnswerPrefix, streamTutorAnswer, TUTOR_TIMEOUT_MS } from "./gemini-tutor";

beforeEach(installGeminiFetch);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const input = () => ({ question: "What is photosynthesis?", history: [], sources: createTutorSources(), signal: new AbortController().signal });
async function collect() { return Array.fromAsync(streamTutorAnswer(input())); }

describe("Gemini tutor SSE", () => {
  it.each([false, true])("decodes split SSE frames (%s CRLF), returns actual deltas then validated JSON", async (crlf) => {
    geminiFetch.mockResolvedValue(splitSseResponse(createTutorSse({ crlf })));
    const events = await collect();
    expect(events.filter((event) => event.type === "delta").map((event) => event.text).join("")).toBe(createTutorAnswer().answer);
    expect(events.at(-1)).toEqual({ type: "answer", answer: createTutorAnswer() });
    const [url, options] = geminiFetch.mock.calls[0];
    expect(url).toMatch(/:streamGenerateContent\?alt=sse$/);
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "test_gemini_key" });
    const body = JSON.parse(String(options?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(JSON.parse(body.contents[0].parts[0].text).sources[0].sourceId).toBe("S1");
  });
  it("emits a delta before provider completion", async () => {
    const text = JSON.stringify(createTutorAnswer());
    geminiFetch.mockResolvedValue(splitSseResponse(createTutorSse({ pieces: [text.slice(0, 35), text.slice(35)] })));
    const iterator = streamTutorAnswer(input());
    expect((await iterator.next()).value).toMatchObject({ type: "delta", text: expect.stringContaining("Photosynthesis") });
    await iterator.return(undefined);
  });
  it("ignores thought parts and decodes Unicode across byte boundaries", async () => {
    const answer = createTutorAnswer({ answer: 'Light → energy 🌿\n"quoted" [S1].' });
    const frame = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "private", thought: true }, { text: JSON.stringify(answer) }] }, finishReason: "STOP" }] })}\n\n`;
    geminiFetch.mockResolvedValue(splitSseResponse(frame, 1));
    const events = await collect();
    expect(events.at(-1)).toEqual({ type: "answer", answer });
    expect(JSON.stringify(events)).not.toContain("private");
  });
  it.each(["MAX_TOKENS", "SAFETY", "RECITATION"])("rejects %s terminal output", async (finishReason) => {
    geminiFetch.mockResolvedValue(splitSseResponse(createTutorSse({ finishReason })));
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it.each(["data: {}\n\n", "data: invalid\n\n", 'data: {"promptFeedback":{"blockReason":"SAFETY"}}\n\n', "x".repeat(1_000_001)])("rejects malformed/incomplete/oversized streams: %#", async (text) => {
    geminiFetch.mockResolvedValue(splitSseResponse(text, 65_536));
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("still delivers answer text when the provider changes JSON key order", async () => {
    const answer = createTutorAnswer();
    geminiFetch.mockResolvedValue(splitSseResponse(createTutorSse({ pieces: [JSON.stringify({ sourceIds: answer.sourceIds, grounding: answer.grounding, answer: answer.answer })] })));
    expect(await collect()).toEqual([{ type: "delta", text: answer.answer }, { type: "answer", answer }]);
  });
  it("rejects schema-invalid JSON at STOP", async () => {
    geminiFetch.mockResolvedValue(splitSseResponse(createTutorSse({ pieces: ['{"answer":"bad"}'] })));
    await expect(collect()).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it.each([401, 429, 500])("sanitizes HTTP %s failure", async (status) => {
    geminiFetch.mockResolvedValue(new Response("private API key", { status }));
    await expect(collect()).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
  });
  it("cancels a stalled fetch on request abort", async () => {
    const controller = new AbortController();
    geminiFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("private")))));
    const assertion = expect(Array.fromAsync(streamTutorAnswer({ ...input(), signal: controller.signal }))).rejects.toMatchObject({ code: "CANCELLED" });
    controller.abort();
    await assertion;
  });
  it("cancels a stalled reader on timeout", async () => {
    const { controller, timeout } = controlGeminiTimeout();
    geminiFetch.mockResolvedValue(new Response(new ReadableStream(), { headers: { "Content-Type": "text/event-stream" } }));
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
