import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chunks, documents, materials } from "@/lib/db/schema";
import { MaterialError } from "@/features/materials/material-error";
import type { MaterialFileType } from "@/features/materials/schemas/material";
import { extractPdf } from "../extractors/pdf-extractor";
import { extractDocx } from "../extractors/docx-extractor";
import { chunkDocument, normalizeText } from "./chunking-service";

export async function extractDocument({ buffer, fileType }: { buffer: Buffer; fileType: MaterialFileType }) {
  try {
    const extracted = fileType === "pdf" ? await extractPdf(buffer) : await extractDocx(buffer);
    extracted.sections = extracted.sections.map((section) => ({ ...section, text: normalizeText(section.text) }));
    const rawText = extracted.sections.map(({ text }) => text).join("\n\n").trim();
    if (!rawText) {
      throw new MaterialError("EXTRACTION_ERROR", "No readable text was found. Upload a text-based document; scanned PDFs need OCR.");
    }
    if (rawText.length > 2_000_000) {
      throw new MaterialError("EXTRACTION_ERROR", "The document contains too much text. Please split it into smaller documents.");
    }
    return { ...extracted, rawText, chunks: chunkDocument({ sections: extracted.sections }) };
  } catch (cause) {
    if (cause instanceof MaterialError) throw cause;
    throw new MaterialError("EXTRACTION_ERROR", "The document could not be read. It may be damaged or password-protected.", { cause });
  }
}

export async function processDocument({
  materialId, userId, buffer, fileType,
}: { materialId: string; userId: string; buffer: Buffer; fileType: MaterialFileType }) {
  const ownedProcessing = and(eq(materials.id, materialId), eq(materials.userId, userId), eq(materials.status, "processing"));
  try {
    const existing = await db.select({ id: materials.id }).from(materials).where(ownedProcessing).limit(1);
    if (!existing.length) return;
    const extracted = await extractDocument({ buffer, fileType });
    await db.transaction(async (tx) => {
      // Serialize with deletion/another processing attempt. Parsing itself holds no lock.
      const [material] = await tx.select({ id: materials.id }).from(materials)
        .where(ownedProcessing).for("update");
      if (!material) return;
      await tx.delete(documents).where(eq(documents.materialId, materialId));
      const [document] = await tx.insert(documents).values({
        materialId, rawText: extracted.rawText, pageCount: extracted.pageCount,
      }).returning({ id: documents.id });
      for (let start = 0; start < extracted.chunks.length; start += 100) {
        await tx.insert(chunks).values(extracted.chunks.slice(start, start + 100).map((chunk) => ({
          materialId, documentId: document.id, content: chunk.text, chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber, sectionHeading: chunk.sectionHeading, tokenCount: chunk.tokenCount,
        })));
      }
      // Analysis runs separately after the extraction transaction commits.
      await tx.update(materials).set({ status: "extracted", errorMessage: null, updatedAt: new Date() }).where(ownedProcessing);
    });
  } catch (cause) {
    console.error("Document ingestion failed", cause);
    const message = cause instanceof MaterialError ? cause.message : "Document processing failed. Please delete it and upload again.";
    await db.update(materials).set({ status: "error", errorMessage: message, updatedAt: new Date() }).where(ownedProcessing);
  }
}
