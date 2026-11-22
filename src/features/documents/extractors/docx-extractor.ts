import mammoth from "mammoth";
import { Parser } from "htmlparser2";
import { validateDocxArchive } from "@/features/materials/services/upload-validation";
import { normalizeText } from "../services/chunking-service";
import type { DocumentSection, ExtractedDocument } from "../types";

export async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  validateDocxArchive(buffer);
  const { value } = await mammoth.convertToHtml({ buffer }, {
    externalFileAccess: false,
    includeEmbeddedStyleMap: false,
    // Do not decode/embed images. We only need text, never HTML in the UI.
    convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
  });
  const sections: DocumentSection[] = [];
  let heading: string | null = null;
  let headingText: string | null = null;
  let text = "";
  const flush = () => {
    const normalized = normalizeText(text);
    if (normalized) sections.push({ text: normalized, pageNumber: null, sectionHeading: heading });
    text = "";
  };
  const parser = new Parser({
    onopentag(name) {
      if (/^h[1-6]$/.test(name)) {
        flush();
        headingText = "";
      }
      if (name === "br") text += "\n";
    },
    ontext(value) {
      if (headingText !== null) headingText += value;
      else text += value;
    },
    onclosetag(name) {
      if (/^h[1-6]$/.test(name) && headingText !== null) {
        heading = normalizeText(headingText);
        text = `${heading}\n\n`;
        headingText = null;
      } else if (["p", "li", "tr"].includes(name)) text += "\n\n";
      else if (["td", "th"].includes(name)) text += "\t";
    },
  }, { decodeEntities: true });
  parser.write(value);
  parser.end();
  flush();
  // DOCX has no reliable rendered pagination. Cite headings, not invented pages.
  return { sections, pageCount: 1 };
}
