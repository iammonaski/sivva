import { TutorError } from "@/features/tutor/tutor-error";

export function safeTutorError(error: unknown) {
  return error instanceof TutorError ? error : new TutorError("PERSISTENCE_ERROR", "The tutor request could not be completed. Please try again.");
}
export function tutorErrorResponse(error: unknown) {
  const safe = safeTutorError(error);
  const status = { NOT_FOUND: 404, NOT_READY: 409, INVALID_INPUT: 400, CONFLICT: 409,
    PROVIDER_ERROR: 502, INVALID_OUTPUT: 502, PERSISTENCE_ERROR: 500, CANCELLED: 408 }[safe.code];
  return Response.json({ error: safe.message, code: safe.code }, { status, headers: { "Cache-Control": "private, no-store" } });
}
