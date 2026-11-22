import { unzipSync } from "fflate";
import { MaterialError } from "../material-error";
import { MAX_FILE_BYTES, uploadMetadataSchema } from "../schemas/material";

export function validateDocxArchive(buffer: Uint8Array) {
  let expandedBytes = 0;
  let entries = 0;
  const names = new Set<string>();
  try {
    // Inspect directory sizes before Mammoth decompresses the archive.
    unzipSync(buffer, {
      filter: ({ name, originalSize }) => {
        expandedBytes += originalSize;
        entries++;
        names.add(name);
        if (expandedBytes > 32 * 1024 * 1024 || entries > 2000) {
          throw new MaterialError("TOO_LARGE", "The DOCX expands beyond the supported size.");
        }
        return false;
      },
    });
    if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) {
      throw new Error("Not a Word document.");
    }
  } catch (cause) {
    if (cause instanceof MaterialError) throw cause;
    throw new MaterialError("INVALID_FILE", "Upload a valid DOCX document.", { cause });
  }
}

export async function readUploadForm(request: Request) {
  const maxBodyBytes = MAX_FILE_BYTES + 64 * 1024;
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data") || !request.body) {
    throw new MaterialError("INVALID_FILE", "Send a multipart form with one document.");
  }
  if (Number(request.headers.get("content-length")) > maxBodyBytes) {
    throw new MaterialError("TOO_LARGE", "Documents must be 4 MB or smaller.");
  }
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        throw new MaterialError("TOO_LARGE", "Documents must be 4 MB or smaller.");
      }
      parts.push(value);
    }
    const form = await new Response(Buffer.concat(parts), { headers: { "content-type": contentType } }).formData();
    const file = form.get("file");
    const title = form.get("title");
    if (!(file instanceof File) || form.getAll("file").length !== 1 || (title !== null && typeof title !== "string")) {
      throw new MaterialError("INVALID_FILE", "Select one PDF or DOCX document.");
    }
    return { file, title: title ?? undefined };
  } catch (cause) {
    if (cause instanceof MaterialError) throw cause;
    throw new MaterialError("INVALID_FILE", "The upload form could not be read.", { cause });
  } finally {
    reader.releaseLock();
  }
}

export async function validateUpload({ file, title }: { file: File; title?: string }) {
  if (file.size > MAX_FILE_BYTES) {
    throw new MaterialError("TOO_LARGE", "Documents must be 4 MB or smaller.");
  }
  const fileName = file.name.split(/[\\/]/).pop() ?? "";
  const extension = fileName.split(".").pop()?.toLowerCase();
  const metadata = uploadMetadataSchema.safeParse({
    fileName,
    fileSize: file.size,
    fileType: extension,
    title: title ?? fileName.replace(/\.[^.]+$/, "").slice(0, 200),
  });
  if (!metadata.success) {
    throw new MaterialError("INVALID_FILE", "Upload a non-empty PDF or DOCX with a valid filename and title.");
  }
  const expectedMime = extension === "pdf" ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (file.type && file.type !== "application/octet-stream" && file.type !== expectedMime) {
    throw new MaterialError("INVALID_FILE", "The file type does not match its extension.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "pdf") {
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new MaterialError("INVALID_FILE", "Upload a valid PDF document.");
    }
  } else {
    validateDocxArchive(buffer);
  }
  return { ...metadata.data, buffer };
}
