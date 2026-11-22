import { strToU8, zipSync } from "fflate";

/** Real, self-contained PDF fixtures: byte offsets and stream lengths are exact. */
export function createPdf({ pages }: { pages: (string | null)[] }): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const [index, text] of pages.entries()) {
    // null paints a real inline image with no text (an image-only/scanned page).
    const escaped = text?.replace(/([\\()])/g, "\\$1");
    const stream = text === null
      ? "q 24 0 0 24 50 700 cm BI /W 1 /H 1 /CS /RGB /BPC 8 /F /AHx ID FF0000> EI Q"
      : text ? `BT /F1 12 Tf 50 700 Td (${escaped}) Tj ET` : "";
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  let source = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(source);
}

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[character]!);

type Paragraph = { text: string; heading?: 1 | 2 | 3 };

/** Minimal OOXML package, including real style definitions for Mammoth. */
export function createDocx({ paragraphs }: { paragraphs: Paragraph[] }): Buffer {
  const body = paragraphs.map(({ text, heading }) => {
    const properties = heading ? `<w:pPr><w:pStyle w:val="Heading${heading}"/></w:pPr>` : "";
    const runs = text.split("\n").map((line) => `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`).join("<w:br/>");
    return `<w:p>${properties}<w:r>${runs}</w:r></w:p>`;
  }).join("");
  return createZip({ entries: {
    "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`,
    "word/_rels/document.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "word/styles.xml": `<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${[1, 2, 3].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:pPr><w:outlineLvl w:val="${level - 1}"/></w:pPr></w:style>`).join("")}</w:styles>`,
  } });
}

export function createZip({ entries }: { entries: Record<string, string> }): Buffer {
  return Buffer.from(zipSync(Object.fromEntries(
    Object.entries(entries).map(([name, text]) => [name, strToU8(text)]),
  )));
}

/** Directory-only safety fixtures avoid allocating/decompressing a ZIP bomb. */
export function createDocxSafetyArchive({ expandedBytes = 0, entryCount = 2 }: {
  expandedBytes?: number;
  entryCount?: number;
}): Buffer {
  const entries: Record<string, string> = { "[Content_Types].xml": "", "word/document.xml": "" };
  for (let index = 2; index < entryCount; index++) entries[`extra-${index}.xml`] = "";
  const archive = createZip({ entries });
  const directory = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  archive.writeUInt32LE(expandedBytes, 22); // First local file's uncompressed size.
  archive.writeUInt32LE(expandedBytes, directory + 24); // Matching central-directory size.
  return archive;
}

export const documentFixtures = {
  pdfPages: ["Lecture one", "", "Lecture three (sources)"],
  docxParagraphs: [
    { text: "Opening paragraph & context." },
    { text: "Energy & motion", heading: 1 },
    { text: "Force < mass > 0 & acceleration.\nNext line: café 漢字 😀." },
    { text: "Worked example", heading: 2 },
    { text: "Compare \"quoted\" terms and apostrophe's meaning." },
  ] satisfies Paragraph[],
  consecutiveHeadings: [
    { text: "First heading", heading: 1 },
    { text: "Second heading", heading: 2 },
    { text: "Body under second heading." },
  ] satisfies Paragraph[],
  sectionBoundaries: [
    { text: "a".repeat(45), pageNumber: 1, sectionHeading: null },
    { text: " \r\n\t ", pageNumber: 2, sectionHeading: null },
    { text: "b".repeat(45), pageNumber: 3, sectionHeading: null },
    { text: "c".repeat(45), pageNumber: null, sectionHeading: "Third topic" },
    { text: "d".repeat(45), pageNumber: null, sectionHeading: "Fourth topic" },
  ],
  plainDocxParagraphs: [{ text: "First paragraph." }, { text: "Second paragraph & details." }],
  emptyDocxParagraphs: [{ text: " \t\n " }],
  normalization: {
    input: " \tCafé\0   notes \r\n  first\tline \r\n\r\n\r\n next \r last ",
    expected: "Café notes\nfirst line\n\nnext\nlast",
  },
  overlapText: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  boundaryText: "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
  largeWord: "x".repeat(10_003),
  unicodeText: "😀漢é𝄞".repeat(13),
  unicodeNormalized: "é😀漢".repeat(10),
  upload: {
    pdfMime: "application/pdf",
    docxMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    invalidPdf: Buffer.from("%PDX-not a PDF"),
    brokenZip: Buffer.from("PK\u0003\u0004broken archive"),
    nonZip: Buffer.from("not a Word document"),
  },
};

export const multipartFixtures = {
  url: "http://localhost/api/materials/upload",
  contentType: "multipart/form-data; boundary=sivva-test-boundary",
  malformedBody: "This is not a multipart body.",
};

export function createMultipartRequest({ files = [createUploadFile()], title, fileText }: {
  files?: File[];
  title?: string | File;
  fileText?: string;
} = {}): Request {
  const form = new FormData();
  for (const file of files) form.append("file", file);
  if (title !== undefined) form.append("title", title);
  if (fileText !== undefined) form.append("file", fileText);
  return new Request(multipartFixtures.url, { method: "POST", body: form });
}

export function createChunkedMultipartRequest({ chunkCount = 66, chunkBytes = 64 * 1024, claimedLength }: {
  chunkCount?: number;
  chunkBytes?: number;
  claimedLength?: string;
} = {}) {
  let emitted = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (emitted === chunkCount) controller.close();
      else {
        emitted++;
        controller.enqueue(new Uint8Array(chunkBytes));
      }
    },
    cancel() { cancelled = true; },
  });
  const headers: Record<string, string> = { "content-type": multipartFixtures.contentType };
  if (claimedLength !== undefined) headers["content-length"] = claimedLength;
  const request = new Request(multipartFixtures.url, {
    method: "POST", body: stream, headers, duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, wasCancelled: () => cancelled };
}

export function createUploadFile({ buffer = createPdf({ pages: ["Lecture"] }), name = "lecture.pdf", type = "application/pdf", size }: {
  buffer?: Buffer;
  name?: string;
  type?: string;
  size?: number;
} = {}): File {
  const bytes = size === undefined ? buffer : Buffer.alloc(size);
  if (size !== undefined) buffer.copy(bytes);
  return new File([new Uint8Array(bytes)], name, { type });
}
