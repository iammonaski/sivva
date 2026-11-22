import { MaterialError } from "@/features/materials/material-error";

export function materialErrorResponse(error: unknown) {
  if (error instanceof MaterialError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "TOO_LARGE" ? 413
      : error.code === "INVALID_FILE" ? 400 : 502;
    return Response.json({ error: error.message }, { status });
  }
  console.error("Material request failed", error);
  return Response.json({ error: "The request failed. Please try again." }, { status: 500 });
}
