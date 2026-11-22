import { extractText, getDocumentProxy } from "unpdf";
import { MaterialError } from "@/features/materials/material-error";
import type { ExtractedDocument } from "../types";

export async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  // Copy: PDF.js owns/transfers the typed array. Do not pass a Node Buffer.
  const pdf = await getDocumentProxy(new Uint8Array(buffer), {
    maxImageSize: 16_777_216,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  try {
    if (pdf.numPages > 300) {
      throw new MaterialError("EXTRACTION_ERROR", "PDFs must contain no more than 300 pages.");
    }
    const { text, totalPages } = await extractText(pdf, { mergePages: false });
    return {
      pageCount: totalPages,
      sections: text.map((page, index) => ({
        text: page,
        pageNumber: index + 1,
        sectionHeading: null,
      })),
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}
