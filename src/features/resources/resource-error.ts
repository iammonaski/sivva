export class ResourceError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "NOT_CONFIGURED" | "UNAVAILABLE" | "QUOTA_EXCEEDED",
    message: string,
  ) {
    super(message);
    this.name = "ResourceError";
  }
}
