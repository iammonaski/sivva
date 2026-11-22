import { describe, expect, it } from "vitest";
import { createDocx, createPdf, documentFixtures } from "../../../../mocks/document-fixtures";
import { MaterialError } from "../../materials/material-error";
import { chunkDocument } from "../services/chunking-service";
import { extractDocument } from "../services/document-service";
import { extractDocx } from "./docx-extractor";
import { extractPdf } from "./pdf-extractor";

describe("extractPdf", () => {
  it("extracts real PDF text while preserving page numbering around an empty page", async () => {
    const buffer = createPdf({ pages: documentFixtures.pdfPages });
    const original = Buffer.from(buffer);
    const extracted = await extractPdf(buffer);
    expect(extracted).toEqual({
      pageCount: 3,
      sections: [
        { text: "Lecture one", pageNumber: 1, sectionHeading: null },
        { text: "", pageNumber: 2, sectionHeading: null },
        { text: "Lecture three (sources)", pageNumber: 3, sectionHeading: null },
      ],
    });
    expect(buffer).toEqual(original);
    expect(chunkDocument({ sections: extracted.sections }).map(({ pageNumber }) => pageNumber)).toEqual([1, 3]);
  });

  it("returns no invented text from an image-only PDF page", async () => {
    expect(await extractPdf(createPdf({ pages: [null] }))).toEqual({
      pageCount: 1,
      sections: [{ text: "", pageNumber: 1, sectionHeading: null }],
    });
  });

  it("rejects PDFs over the page limit", async () => {
    await expect(extractPdf(createPdf({ pages: Array.from({ length: 301 }, () => "") })))
      .rejects.toMatchObject({ name: "MaterialError", code: "EXTRACTION_ERROR", message: expect.stringContaining("300 pages") });
  });

  it("accepts exactly the supported page limit", async () => {
    const extracted = await extractPdf(createPdf({ pages: Array.from({ length: 300 }, () => "") }));
    expect(extracted.pageCount).toBe(300);
    expect(extracted.sections.at(-1)?.pageNumber).toBe(300);
  });
});

describe("extractDocx", () => {
  it("preserves heading sections and converts entities and line breaks to plain Unicode text", async () => {
    const extracted = await extractDocx(createDocx({ paragraphs: documentFixtures.docxParagraphs }));
    expect(extracted).toEqual({
      pageCount: 1,
      sections: [
        { text: "Opening paragraph & context.", pageNumber: null, sectionHeading: null },
        { text: "Energy & motion\n\nForce < mass > 0 & acceleration.\nNext line: café 漢字 😀.", pageNumber: null, sectionHeading: "Energy & motion" },
        { text: "Worked example\n\nCompare \"quoted\" terms and apostrophe's meaning.", pageNumber: null, sectionHeading: "Worked example" },
      ],
    });
    expect(extracted.sections.map(({ text }) => text).join("\n")).not.toMatch(/<\/?(?:p|h[1-6]|br)\b|&(?:amp|lt|gt);/);
  });

  it("handles consecutive headings without discarding heading-only sections", async () => {
    const extracted = await extractDocx(createDocx({ paragraphs: documentFixtures.consecutiveHeadings }));
    expect(extracted.sections).toEqual([
      { text: "First heading", pageNumber: null, sectionHeading: "First heading" },
      { text: "Second heading\n\nBody under second heading.", pageNumber: null, sectionHeading: "Second heading" },
    ]);
  });

  it("extracts unheaded paragraphs without inventing pagination or headings", async () => {
    expect(await extractDocx(createDocx({ paragraphs: documentFixtures.plainDocxParagraphs }))).toEqual({
      pageCount: 1,
      sections: [{ text: "First paragraph.\n\nSecond paragraph & details.", pageNumber: null, sectionHeading: null }],
    });
  });

  it("returns no sections for a whitespace-only DOCX", async () => {
    expect(await extractDocx(createDocx({ paragraphs: documentFixtures.emptyDocxParagraphs })))
      .toEqual({ pageCount: 1, sections: [] });
  });
});

describe("extractDocument", () => {
  it("normalizes real extracted text and retains actual PDF citations and ordered chunks", async () => {
    const extracted = await extractDocument({ buffer: createPdf({ pages: documentFixtures.pdfPages }), fileType: "pdf" });
    expect(extracted.rawText).toBe("Lecture one\n\n\n\nLecture three (sources)");
    expect(extracted.pageCount).toBe(3);
    expect(extracted.chunks.map(({ chunkIndex, pageNumber }) => ({ chunkIndex, pageNumber }))).toEqual([
      { chunkIndex: 0, pageNumber: 1 }, { chunkIndex: 1, pageNumber: 3 },
    ]);
  });

  it("rejects an image-only scanned PDF with actionable OCR guidance", async () => {
    await expect(extractDocument({ buffer: createPdf({ pages: [null] }), fileType: "pdf" }))
      .rejects.toMatchObject({ name: "MaterialError", code: "EXTRACTION_ERROR", message: expect.stringContaining("OCR") });
  });

  it("rejects an all-blank PDF", async () => {
    await expect(extractDocument({ buffer: createPdf({ pages: ["", ""] }), fileType: "pdf" }))
      .rejects.toMatchObject({ name: "MaterialError", code: "EXTRACTION_ERROR", message: expect.stringContaining("No readable text") });
  });

  it("rejects a whitespace-only DOCX", async () => {
    await expect(extractDocument({ buffer: createDocx({ paragraphs: documentFixtures.emptyDocxParagraphs }), fileType: "docx" }))
      .rejects.toMatchObject({ name: "MaterialError", code: "EXTRACTION_ERROR", message: expect.stringContaining("No readable text") });
  });

  it("wraps an unreadable PDF in a typed extraction error", async () => {
    await expect(extractDocument({ buffer: documentFixtures.upload.invalidPdf, fileType: "pdf" }))
      .rejects.toBeInstanceOf(MaterialError);
    await expect(extractDocument({ buffer: documentFixtures.upload.invalidPdf, fileType: "pdf" }))
      .rejects.toMatchObject({ code: "EXTRACTION_ERROR", cause: expect.any(Error) });
  });
});
