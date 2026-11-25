import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";

const MAX_RESPONSE_BYTES = 1_000_000;

export class GeminiResponseTooLargeError extends Error {
  constructor() { super("Provider response budget exceeded"); }
}

// Keep HTTP safeguards at the SDK's supported fetch hook; the SDK owns all
// request serialization, response parsing and provider SSE framing.
export const geminiClient = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "v1beta",
    retryOptions: { attempts: 1 },
    fetch: async (url, options) => {
      const response = await fetch(url, { ...options, cache: "no-store" });
      if (!response.ok) {
        // Provider error bodies can echo keys or source content. Do not parse them.
        await response.body?.cancel();
        return new Response(null, { status: response.status, statusText: "Provider error" });
      }
      if (!response.body) return response;
      let bytes = 0;
      const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) throw new GeminiResponseTooLargeError();
          controller.enqueue(chunk);
        },
      }));
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    },
  },
});
