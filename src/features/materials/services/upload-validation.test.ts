import { describe, expect, it } from "vitest";
import {
  createChunkedMultipartRequest, createDocx, createDocxSafetyArchive,
  createMultipartRequest, createUploadFile, createZip, documentFixtures, multipartFixtures,
} from "../../../../mocks/document-fixtures";
import { MaterialError } from "../material-error";
import { MAX_FILE_BYTES } from "../schemas/material";
import { readUploadForm, validateDocxArchive, validateUpload } from "./upload-validation";

function expectArchiveError(buffer: Buffer, code: "INVALID_FILE" | "TOO_LARGE") {
  expect(() => validateDocxArchive(buffer)).toThrow(MaterialError);
  expect(() => validateDocxArchive(buffer)).toThrow(expect.objectContaining({ code }));
}

describe("validateUpload", () => {
  it("accepts a PDF and returns validated metadata and the original bytes", async () => {
    const file = createUploadFile();
    const result = await validateUpload({ file });
    expect(result).toEqual({
      fileName: "lecture.pdf", title: "lecture", fileType: "pdf", fileSize: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
  });

  it("accepts a real DOCX with its correct MIME type", async () => {
    const buffer = createDocx({ paragraphs: documentFixtures.docxParagraphs });
    const result = await validateUpload({ file: createUploadFile({ buffer, name: "notes.docx", type: documentFixtures.upload.docxMime }) });
    expect(result).toMatchObject({ fileName: "notes.docx", fileType: "docx", title: "notes", buffer });
  });

  it.each(["/home/course/Lecture.PDF", "C:\\fakepath\\Lecture.PDF"])("strips path segments and accepts uppercase PDF extension: %s", async (name) => {
    const result = await validateUpload({ file: createUploadFile({ name }) });
    expect(result).toMatchObject({ fileName: "Lecture.PDF", fileType: "pdf", title: "Lecture" });
  });

  it("accepts an uppercase DOCX extension", async () => {
    const result = await validateUpload({ file: createUploadFile({
      buffer: createDocx({ paragraphs: documentFixtures.plainDocxParagraphs }), name: "Notes.DOCX", type: documentFixtures.upload.docxMime,
    }) });
    expect(result).toMatchObject({ fileName: "Notes.DOCX", fileType: "docx", title: "Notes" });
  });

  it.each(["", "application/octet-stream"])("accepts unknown/generic browser MIME %j only with valid document bytes", async (type) => {
    await expect(validateUpload({ file: createUploadFile({ type }) })).resolves.toMatchObject({ fileType: "pdf" });
    await expect(validateUpload({ file: createUploadFile({ type, buffer: documentFixtures.upload.invalidPdf }) }))
      .rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it.each(["text/plain", documentFixtures.upload.docxMime])("rejects a MIME that disagrees with the PDF extension: %s", async (type) => {
    await expect(validateUpload({ file: createUploadFile({ type }) })).rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("rejects a DOCX carrying the PDF MIME", async () => {
    await expect(validateUpload({ file: createUploadFile({ buffer: createDocx({ paragraphs: [] }), name: "notes.docx" }) }))
      .rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("accepts exactly the file-size limit and rejects the next byte", async () => {
    await expect(validateUpload({ file: createUploadFile({ size: MAX_FILE_BYTES }) }))
      .resolves.toMatchObject({ fileSize: MAX_FILE_BYTES });
    await expect(validateUpload({ file: createUploadFile({ size: MAX_FILE_BYTES + 1 }) }))
      .rejects.toMatchObject({ name: "MaterialError", code: "TOO_LARGE" });
  });

  it("rejects an empty file and a PDF with an invalid signature", async () => {
    await expect(validateUpload({ file: createUploadFile({ size: 0 }) })).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(validateUpload({ file: createUploadFile({ buffer: documentFixtures.upload.invalidPdf }) }))
      .rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it.each(["", "   ", "notes", "notes.txt", ".pdf", "notes.pdf.exe", "/", `${"x".repeat(252)}.pdf`])("rejects invalid filename %j", async (name) => {
    await expect(validateUpload({ file: createUploadFile({ name }) })).rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("trims an explicit title and caps a derived long title", async () => {
    await expect(validateUpload({ file: createUploadFile(), title: "  Course notes  " })).resolves.toMatchObject({ title: "Course notes" });
    const result = await validateUpload({ file: createUploadFile({ name: `${"x".repeat(220)}.pdf` }) });
    expect(result.title).toHaveLength(200);
  });

  it.each(["", " \t ", "x".repeat(201)])("rejects invalid title %j", async (title) => {
    await expect(validateUpload({ file: createUploadFile(), title })).rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("rejects a disguised non-Word ZIP despite a DOCX MIME and extension", async () => {
    const buffer = createZip({ entries: { "other.xml": "not Word" } });
    await expect(validateUpload({ file: createUploadFile({ buffer, name: "notes.docx", type: documentFixtures.upload.docxMime }) }))
      .rejects.toMatchObject({ name: "MaterialError", code: "INVALID_FILE" });
  });
});

describe("validateDocxArchive", () => {
  it("accepts the required OOXML archive entries", () => {
    expect(() => validateDocxArchive(createDocx({ paragraphs: documentFixtures.plainDocxParagraphs }))).not.toThrow();
  });

  it.each<Record<string, string>>([
    { "[Content_Types].xml": "" },
    { "word/document.xml": "" },
    { "other.xml": "not a Word package" },
  ])("rejects an archive missing Word package entries %j", (entries) => {
    expectArchiveError(createZip({ entries }), "INVALID_FILE");
  });

  it("rejects a non-ZIP or truncated ZIP as a typed invalid-file error", () => {
    expectArchiveError(documentFixtures.upload.nonZip, "INVALID_FILE");
    expectArchiveError(documentFixtures.upload.brokenZip, "INVALID_FILE");
  });

  it("enforces expanded size from ZIP metadata without decompressing huge content", () => {
    expect(() => validateDocxArchive(createDocxSafetyArchive({ expandedBytes: 32 * 1024 * 1024 }))).not.toThrow();
    expectArchiveError(createDocxSafetyArchive({ expandedBytes: 32 * 1024 * 1024 + 1 }), "TOO_LARGE");
  });

  it("accepts exactly the ZIP entry limit and rejects one extra entry", () => {
    expect(() => validateDocxArchive(createDocxSafetyArchive({ entryCount: 2000 }))).not.toThrow();
    expectArchiveError(createDocxSafetyArchive({ entryCount: 2001 }), "TOO_LARGE");
  });
});

describe("readUploadForm", () => {
  it("reads one real multipart file and optional title", async () => {
    const file = createUploadFile();
    const result = await readUploadForm(createMultipartRequest({ files: [file], title: "Course notes" }));
    expect(result.title).toBe("Course notes");
    expect(result.file.name).toBe(file.name);
    expect(Buffer.from(await result.file.arrayBuffer())).toEqual(Buffer.from(await file.arrayBuffer()));
  });

  it("leaves an omitted title undefined", async () => {
    await expect(readUploadForm(createMultipartRequest())).resolves.toMatchObject({ title: undefined });
  });

  it("rejects duplicate uploaded files", async () => {
    await expect(readUploadForm(createMultipartRequest({ files: [createUploadFile(), createUploadFile()] })))
      .rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("rejects missing files, text in place of a file, and file-valued titles", async () => {
    await expect(readUploadForm(createMultipartRequest({ files: [] }))).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(readUploadForm(createMultipartRequest({ files: [], fileText: "not a document" })))
      .rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(readUploadForm(createMultipartRequest({ title: createUploadFile() })))
      .rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("rejects non-multipart content types and missing request bodies", async () => {
    const request = new Request(multipartFixtures.url, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    await expect(readUploadForm(request)).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(readUploadForm(new Request(multipartFixtures.url, { method: "POST", headers: { "content-type": multipartFixtures.contentType } })))
      .rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("maps malformed multipart parsing to a typed invalid-file error", async () => {
    const request = new Request(multipartFixtures.url, {
      method: "POST", body: multipartFixtures.malformedBody, headers: { "content-type": multipartFixtures.contentType },
    });
    await expect(readUploadForm(request)).rejects.toMatchObject({ name: "MaterialError", code: "INVALID_FILE", cause: expect.any(Error) });
  });

  it("rejects a declared oversized multipart body before parsing it", async () => {
    const request = createMultipartRequest();
    request.headers.set("content-length", String(MAX_FILE_BYTES + 64 * 1024 + 1));
    await expect(readUploadForm(request)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it.each([undefined, "1"])("caps a chunked stream with missing or dishonest content-length %j and cancels it", async (claimedLength) => {
    const { request, wasCancelled } = createChunkedMultipartRequest({ claimedLength });
    await expect(readUploadForm(request)).rejects.toMatchObject({ name: "MaterialError", code: "TOO_LARGE" });
    expect(wasCancelled()).toBe(true);
    expect(request.body!.locked).toBe(false);
  });
});
