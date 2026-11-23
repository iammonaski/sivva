export type TutorErrorCode = "NOT_FOUND" | "NOT_READY" | "INVALID_INPUT" | "CONFLICT" | "PROVIDER_ERROR" | "INVALID_OUTPUT" | "PERSISTENCE_ERROR" | "CANCELLED";

export class TutorError extends Error {
  constructor(public readonly code: TutorErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TutorError";
  }
}
