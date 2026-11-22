export class MaterialError extends Error {
  constructor(
    public readonly code: "INVALID_FILE" | "TOO_LARGE" | "NOT_FOUND" | "STORAGE_ERROR" | "EXTRACTION_ERROR",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MaterialError";
  }
}
