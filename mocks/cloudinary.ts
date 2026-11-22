import { PassThrough } from "node:stream";
import { v2 as cloudinary, type UploadApiOptions, type UploadResponseCallback } from "cloudinary";
import { vi } from "vitest";

export function mockCloudinaryUpload({ result = { public_id: "materials/test.pdf" }, error }: {
  result?: unknown;
  error?: Error;
} = {}) {
  return vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation((
    options?: UploadApiOptions | UploadResponseCallback, callback?: UploadResponseCallback,
  ) => {
    const stream = new PassThrough();
    stream.on("finish", () => {
      if (typeof options === "function") throw new Error("Expected upload options.");
      // Deliberately malformed provider responses test boundary validation.
      callback?.(error as Parameters<NonNullable<typeof callback>>[0], result as Parameters<NonNullable<typeof callback>>[1]);
    });
    stream.resume();
    return stream as ReturnType<typeof cloudinary.uploader.upload_stream>;
  });
}

export function mockCloudinaryDeletion(result: unknown = { result: "ok" }) {
  return vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue(result);
}
