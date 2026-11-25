import { genaiFetch, installGenaiFetch } from "../../../mocks/genai-transport";
import { createAnalysis, createGeminiResponse } from "../../../mocks/analysis-fixtures";
import { createTutorChunks, createTutorAnswer, createTutorSources, splitSseResponse } from "../../../mocks/tutor-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDocumentAnalysis } from "./gemini";
import { streamTutorAnswer } from "./gemini-tutor";

beforeEach(installGenaiFetch);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const tutorInput = () => ({ question: "Explain this", history: [], sources: createTutorSources(), signal: new AbortController().signal });

describe("real Google Gen AI SDK transport safeguards", () => {
  it("configures API authentication, v1beta, no-store and structured generation", async () => {
    genaiFetch.mockResolvedValue(Response.json(createGeminiResponse()));
    expect(await generateDocumentAnalysis({ rawText: "Lecture" })).toEqual(createAnalysis());
    const [url, options] = genaiFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/v1beta\/models\/gemini-.*:generateContent$/);
    expect(String(url)).not.toContain("test_gemini_key");
    expect(new Headers(options?.headers).get("x-goog-api-key")).toBe("test_gemini_key");
    expect(options?.cache).toBe("no-store");
    const body = JSON.parse(String(options?.body));
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", maxOutputTokens: 16_384,
      responseJsonSchema: { type: "object", required: ["topics", "studyGuide"] },
    });
  });
  it.each([401, 429, 500])("discards error bodies and does not retry HTTP %s", async (status) => {
    const cancel = vi.fn();
    genaiFetch.mockResolvedValue(new Response(new ReadableStream({ cancel }), { status }));
    const error = await generateDocumentAnalysis({ rawText: "Lecture" }).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
    expect(cancel).toHaveBeenCalledOnce();
    expect(genaiFetch).toHaveBeenCalledOnce();
  });
  it("bounds the raw analysis response before SDK JSON parsing", async () => {
    genaiFetch.mockResolvedValue(new Response("x".repeat(1_000_001)));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("lets the SDK parse provider SSE while preserving the public event contract", async () => {
    const frames = createTutorChunks().map((chunk) => `data: ${JSON.stringify(chunk)}\r\n\r\n`).join("");
    genaiFetch.mockResolvedValue(splitSseResponse(frames));
    const events = await Array.fromAsync(streamTutorAnswer(tutorInput()));
    expect(events.filter((event) => event.type === "delta").map((event) => event.text).join("")).toBe(createTutorAnswer().answer);
    expect(events.at(-1)).toEqual({ type: "answer", answer: createTutorAnswer() });
    expect(String(genaiFetch.mock.calls[0][0])).toMatch(/:streamGenerateContent\?alt=sse$/);
  });
  it("bounds raw stream bytes even without a complete SDK event", async () => {
    genaiFetch.mockResolvedValue(splitSseResponse("x".repeat(1_000_001), 65_536));
    await expect(Array.fromAsync(streamTutorAnswer(tutorInput()))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("aborts the underlying stream when consumption ends early", async () => {
    const frames = createTutorChunks().map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("");
    const cancel = vi.fn();
    genaiFetch.mockImplementation(async (_url, options) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(frames));
          options?.signal?.addEventListener("abort", () => controller.error(options.signal?.reason), { once: true });
        },
        cancel,
      });
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    });
    const iterator = streamTutorAnswer(tutorInput());
    expect((await iterator.next()).value?.type).toBe("delta");
    await iterator.return(undefined);
    expect(genaiFetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
