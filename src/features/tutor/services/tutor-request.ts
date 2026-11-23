import { TutorError } from "../tutor-error";
import { tutorRequestSchema } from "../schemas/tutor";

const MAX_REQUEST_BYTES = 16_384;
export async function readTutorRequest(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || !request.body) {
    throw new TutorError("INVALID_INPUT", "Send a JSON question.");
  }
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) throw new Error("Request too large");
      parts.push(value);
    }
    return tutorRequestSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts))));
  } catch {
    await reader.cancel().catch(() => {});
    throw new TutorError("INVALID_INPUT", "Send a valid JSON question of 1–2,000 characters.");
  } finally { reader.releaseLock(); }
}
