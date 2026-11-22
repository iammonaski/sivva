import { installGeminiFetch, geminiFetch, controlGeminiTimeout } from "../../../mocks/gemini-http";
import { createAnalysis, createGeminiResponse } from "../../../mocks/analysis-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDocumentAnalysis, GEMINI_TIMEOUT_MS, MAX_ANALYSIS_CHARACTERS } from "./gemini";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompts/document-analysis";

beforeEach(installGeminiFetch);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Gemini structured analysis client", () => {
  it("uses authenticated REST, a system prompt, schema and timeout, returning validated JSON", async () => {
    geminiFetch.mockResolvedValue(Response.json(createGeminiResponse()));
    expect(await generateDocumentAnalysis({ rawText: "Lecture source" })).toEqual(createAnalysis());
    const [url, options] = geminiFetch.mock.calls[0];
    expect(url).toMatch(/^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-.*:generateContent$/);
    expect(url).not.toContain("test_gemini_key");
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "test_gemini_key" });
    expect(options?.cache).toBe("no-store");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const request = JSON.parse(String(options?.body));
    expect(request.systemInstruction.parts[0].text).toBe(ANALYSIS_SYSTEM_PROMPT);
    expect(JSON.parse(request.contents[0].parts[0].text)).toEqual({ sourceDocument: "Lecture source" });
    expect(request.generationConfig).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: { type: "object", required: ["topics", "studyGuide"] } });
  });
  it.each(["", " ", "x".repeat(MAX_ANALYSIS_CHARACTERS + 1)])("rejects empty/oversize source before network calls: %#", async (rawText) => {
    await expect(generateDocumentAnalysis({ rawText })).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    expect(geminiFetch).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])("sanitizes provider HTTP %s errors", async (status) => {
    geminiFetch.mockResolvedValue(new Response("private text and API key", { status }));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
  });
  it("sanitizes network failures", async () => {
    geminiFetch.mockRejectedValue(new Error("private source text"));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
  });
  it("cancels a stalled request through its configured timeout signal", async () => {
    const { controller, timeout } = controlGeminiTimeout();
    geminiFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(options.signal?.reason));
    }));
    const assertion = expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(timeout).toHaveBeenCalledWith(GEMINI_TIMEOUT_MS);
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    await assertion;
  });
  it.each(["MAX_TOKENS", "SAFETY", "RECITATION"])("rejects %s output rather than storing a partial analysis", async (finishReason) => {
    geminiFetch.mockResolvedValue(Response.json(createGeminiResponse({ finishReason })));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it.each([
    { promptFeedback: { blockReason: "SAFETY" } }, {},
    createGeminiResponse({ output: { topics: [] } }),
    createGeminiResponse({ blockReason: "SAFETY" }),
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "```json invalid```" }] } }] },
  ])("rejects malformed, blocked, or schema-invalid responses: %#", async (response) => {
    geminiFetch.mockResolvedValue(Response.json(response));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("ignores thought parts and joins structured output parts", async () => {
    const text = JSON.stringify(createAnalysis());
    geminiFetch.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [
      { text: "private reasoning", thought: true }, { text: text.slice(0, 20) }, { text: text.slice(20) },
    ] } }] }));
    expect(await generateDocumentAnalysis({ rawText: "Lecture" })).toEqual(createAnalysis());
  });
  it("rejects malformed envelopes and bounded response overflow", async () => {
    geminiFetch.mockResolvedValueOnce(new Response("not JSON"));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    geminiFetch.mockResolvedValueOnce(new Response("x".repeat(1_000_001)));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
});
