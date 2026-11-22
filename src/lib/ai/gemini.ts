import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { AnalysisError } from "@/features/analysis/analysis-error";
import { analysisSchema, type DocumentAnalysis } from "./schemas/document-analysis";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts/document-analysis";

// A conservative character budget, not a token estimate. Never silently truncate.
export const MAX_ANALYSIS_CHARACTERS = 200_000;
export const GEMINI_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const sourceSchema = z.string().trim().min(1).max(MAX_ANALYSIS_CHARACTERS);
const responseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z.array(z.object({
    finishReason: z.string(),
    content: z.object({ parts: z.array(z.object({
      text: z.string().optional(),
      thought: z.boolean().optional(),
    })) }).optional(),
  })).optional(),
});

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Empty provider response");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Provider response too large");
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

export async function generateDocumentAnalysis({ rawText }: { rawText: string }): Promise<DocumentAnalysis> {
  const source = sourceSchema.safeParse(rawText);
  if (!source.success) {
    throw new AnalysisError("INPUT_TOO_LARGE", "The document is empty or too large for AI analysis. Please split it into smaller documents.");
  }
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ANALYSIS_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildAnalysisPrompt({ rawText: source.data }) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(analysisSchema),
          maxOutputTokens: 16_384,
        },
      }),
    });
  } catch (cause) {
    throw new AnalysisError("PROVIDER_ERROR", "AI analysis could not connect or timed out. Please try uploading again later.", { cause });
  }
  if (!response.ok) {
    // Do not read/log the provider error body: it can echo keys or source content.
    await response.body?.cancel();
    throw new AnalysisError("PROVIDER_ERROR", "AI analysis is temporarily unavailable. Please try uploading again later.");
  }
  try {
    const result = responseSchema.parse(await readBoundedJson(response));
    const candidate = result.candidates?.[0];
    if (result.promptFeedback?.blockReason || !candidate || candidate.finishReason !== "STOP") {
      throw new Error("Blocked or incomplete AI output");
    }
    const text = candidate.content?.parts.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
    return analysisSchema.parse(JSON.parse(text));
  } catch (cause) {
    throw new AnalysisError("INVALID_OUTPUT", "AI analysis returned an incomplete or invalid study guide. Please try uploading again later.", { cause });
  }
}
