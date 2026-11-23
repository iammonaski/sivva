import { z } from "zod";
import { env } from "@/lib/env";
import { createTRPCContext } from "@/server/trpc/context";
import { safeTutorError, tutorErrorResponse } from "@/server/tutor-error-response";
import { prepareTutorTurn } from "@/features/tutor/services/tutor-service";
import { readTutorRequest } from "@/features/tutor/services/tutor-request";
import { TutorError } from "@/features/tutor/tutor-error";
import type { TutorEvent } from "@/features/tutor/schemas/tutor";

export const maxDuration = 180;

export async function POST(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const cancellation = new AbortController();
  let readerCancelled = false;
  const abort = () => cancellation.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const cleanup = () => request.signal.removeEventListener("abort", abort);
  try {
    if (request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin) {
      cleanup();
      return Response.json({ error: "Ask questions from this application's workspace." }, { status: 403 });
    }
    const { session } = await createTRPCContext();
    if (!session?.user) {
      cleanup();
      return Response.json({ error: "Sign in to ask questions." }, { status: 401 });
    }
    const parsedId = z.uuid().safeParse((await params).materialId);
    if (!parsedId.success) throw new TutorError("INVALID_INPUT", "Invalid material ID.");
    const input = await readTutorRequest(request);
    const iterator = await prepareTutorTurn({ ...input, materialId: parsedId.data, userId: session.user.id, signal: cancellation.signal });
    const encoder = new TextEncoder();
    const encode = (event: TutorEvent) => encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (readerCancelled) { cleanup(); return; }
          if (cancellation.signal.aborted) throw new TutorError("CANCELLED", "The tutor request was cancelled.");
          if (done) { cleanup(); controller.close(); }
          else controller.enqueue(encode(value));
        } catch (error) {
          cleanup();
          if (readerCancelled) return;
          const safe = safeTutorError(error);
          controller.enqueue(encode({ type: "error", code: safe.code, error: safe.message }));
          controller.close();
        }
      },
      async cancel() {
        readerCancelled = true;
        cancellation.abort();
        cleanup();
        await iterator.return(undefined);
      },
    });
    return new Response(stream, { headers: {
      "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no",
    } });
  } catch (error) {
    cancellation.abort();
    cleanup();
    return tutorErrorResponse(error);
  }
}
