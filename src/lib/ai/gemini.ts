import "server-only";
import { type GenerateContentResponse } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { AnalysisError } from "@/features/analysis/analysis-error";
import { analysisSchema, type DocumentAnalysis } from "./schemas/document-analysis";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts/document-analysis";
import { geminiClient, GeminiResponseTooLargeError } from "./gemini-client";

// A conservative character budget, not a token estimate. Never silently truncate.
export const MAX_ANALYSIS_CHARACTERS = 200_000;
export const GEMINI_TIMEOUT_MS = 120_000;
const sourceSchema = z.string().trim().min(1).max(MAX_ANALYSIS_CHARACTERS);

export async function generateDocumentAnalysis({ rawText }: { rawText: string }): Promise<DocumentAnalysis> {
  const source = sourceSchema.safeParse(rawText);
  if (!source.success) {
    throw new AnalysisError("INPUT_TOO_LARGE", "The document is empty or too large for AI analysis. Please split it into smaller documents.");
  }
  let response: GenerateContentResponse;
  try {
    response = await geminiClient.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: buildAnalysisPrompt({ rawText: source.data }) }] }],
      config: {
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(analysisSchema),
        maxOutputTokens: 16_384,
        httpOptions: { timeout: GEMINI_TIMEOUT_MS },
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    });
  } catch (cause) {
    if (cause instanceof GeminiResponseTooLargeError) {
      throw new AnalysisError("INVALID_OUTPUT", "AI analysis returned an incomplete or invalid study guide. Please try uploading again later.", { cause });
    }
    throw new AnalysisError("PROVIDER_ERROR", "AI analysis could not connect or timed out. Please try uploading again later.", { cause });
  }
  try {
    const candidate = response.candidates?.[0];
    if (response.promptFeedback?.blockReason || !candidate || candidate.finishReason !== "STOP") {
      throw new Error("Blocked or incomplete AI output");
    }
    const text = candidate.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
    return analysisSchema.parse(JSON.parse(text));
  } catch (cause) {
    throw new AnalysisError("INVALID_OUTPUT", "AI analysis returned an incomplete or invalid study guide. Please try uploading again later.", { cause });
  }
}
