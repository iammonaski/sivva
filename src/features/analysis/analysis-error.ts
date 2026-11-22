export type AnalysisErrorCode = "NOT_FOUND" | "INPUT_TOO_LARGE" | "INVALID_OUTPUT" | "PROVIDER_ERROR" | "PERSISTENCE_ERROR";

export class AnalysisError extends Error {
  constructor(public readonly code: AnalysisErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AnalysisError";
  }
}
