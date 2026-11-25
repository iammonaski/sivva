import { resetGenai, genai, controlGeminiTimeout } from "../../../mocks/genai";
import { createAnalysis, createGeminiResponse } from "../../../mocks/analysis-fixtures";
import { ApiError, BlockedReason, FinishReason, GenerateContentResponse } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDocumentAnalysis, GEMINI_TIMEOUT_MS, MAX_ANALYSIS_CHARACTERS } from "./gemini";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompts/document-analysis";
import { GeminiResponseTooLargeError } from "./gemini-client";

beforeEach(resetGenai);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Gemini structured analysis SDK client", () => {
  it("uses the configured model, system prompt, schema and timeout, returning validated JSON", async () => {
    genai.models.generateContent.mockResolvedValue(createGeminiResponse());
    expect(await generateDocumentAnalysis({ rawText: "Lecture source" })).toEqual(createAnalysis());
    const request = genai.models.generateContent.mock.calls[0][0];
    expect(request.model).toMatch(/^gemini-/);
    expect(request.config).toMatchObject({
      systemInstruction: ANALYSIS_SYSTEM_PROMPT, responseMimeType: "application/json",
      responseJsonSchema: { type: "object", required: ["topics", "studyGuide"] },
      maxOutputTokens: 16_384, httpOptions: { timeout: GEMINI_TIMEOUT_MS }, abortSignal: expect.any(AbortSignal),
    });
    expect(request.contents).toEqual([{ role: "user", parts: [{ text: JSON.stringify({ sourceDocument: "Lecture source" }) }] }]);
  });
  it.each(["", " ", "x".repeat(MAX_ANALYSIS_CHARACTERS + 1)])("rejects empty/oversize input before the SDK call: %#", async (rawText) => {
    await expect(generateDocumentAnalysis({ rawText })).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    expect(genai.models.generateContent).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])("sanitizes SDK API %s errors", async (status) => {
    genai.models.generateContent.mockRejectedValue(new ApiError({ status, message: "private source and key" }));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
    expect(genai.models.generateContent).toHaveBeenCalledTimes(1);
  });
  it("sanitizes network failures", async () => {
    genai.models.generateContent.mockRejectedValue(new Error("private source text"));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: expect.not.stringContaining("private") });
  });
  it("cancels a stalled SDK request through its timeout signal", async () => {
    const { controller, timeout } = controlGeminiTimeout();
    genai.models.generateContent.mockImplementation(({ config }) => new Promise((_resolve, reject) => {
      config?.abortSignal?.addEventListener("abort", () => reject(config.abortSignal?.reason));
    }));
    const assertion = expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(timeout).toHaveBeenCalledWith(GEMINI_TIMEOUT_MS);
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    await assertion;
  });
  it.each([FinishReason.MAX_TOKENS, FinishReason.SAFETY, FinishReason.RECITATION])("rejects %s rather than storing partial analysis", async (finishReason) => {
    genai.models.generateContent.mockResolvedValue(createGeminiResponse({ finishReason }));
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it.each([
    Object.assign(new GenerateContentResponse(), { promptFeedback: { blockReason: BlockedReason.SAFETY } }),
    new GenerateContentResponse(), createGeminiResponse({ output: { topics: [] } }),
    createGeminiResponse({ blockReason: BlockedReason.SAFETY }),
    Object.assign(new GenerateContentResponse(), { candidates: [{ finishReason: FinishReason.STOP, content: { parts: [{ text: "```json invalid```" }] } }] }),
  ])("rejects blocked, incomplete, or schema-invalid output: %#", async (response) => {
    genai.models.generateContent.mockResolvedValue(response);
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
  it("ignores thoughts, joins text parts, and uses only the first candidate", async () => {
    const text = JSON.stringify(createAnalysis());
    const response = Object.assign(new GenerateContentResponse(), { candidates: [
      { finishReason: FinishReason.STOP, content: { parts: [
        { text: "private reasoning", thought: true }, { text: text.slice(0, 20) }, { text: text.slice(20) },
      ] } },
      { finishReason: FinishReason.SAFETY },
    ] });
    genai.models.generateContent.mockResolvedValue(response);
    expect(await generateDocumentAnalysis({ rawText: "Lecture" })).toEqual(createAnalysis());
  });
  it("maps the response byte guard to invalid output", async () => {
    genai.models.generateContent.mockRejectedValue(new GeminiResponseTooLargeError());
    await expect(generateDocumentAnalysis({ rawText: "Lecture" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });
});
