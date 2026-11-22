import { z } from "zod";
import type { DocumentChunk, DocumentSection } from "../types";

const optionsSchema = z.object({
  maxTokens: z.number().int().min(1).max(1000).default(750),
  overlapTokens: z.number().int().min(0).default(100),
}).refine(({ maxTokens, overlapTokens }) => overlapTokens < maxTokens, {
  message: "Overlap must be smaller than the chunk size.",
});

export function normalizeText(text: string) {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\0/g, "")
    .replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function chunkDocument({
  sections,
  maxTokens,
  overlapTokens,
}: {
  sections: DocumentSection[];
  maxTokens?: number;
  overlapTokens?: number;
}): DocumentChunk[] {
  const options = optionsSchema.parse({ maxTokens, overlapTokens });
  const maxCharacters = options.maxTokens * 4;
  const overlapCharacters = options.overlapTokens * 4;
  const chunks: DocumentChunk[] = [];

  // Four Unicode characters/token is an estimate, not a Gemini tokenizer.
  // Never cross page or section boundaries: each citation stays unambiguous.
  for (const section of sections) {
    const characters = Array.from(normalizeText(section.text));
    let start = 0;
    while (start < characters.length) {
      let end = Math.min(start + maxCharacters, characters.length);
      if (end < characters.length) {
        const minimumEnd = start + Math.floor(maxCharacters * 0.75);
        for (let boundary = end; boundary > minimumEnd; boundary--) {
          if (/\s/.test(characters[boundary] ?? "")) {
            end = boundary;
            break;
          }
        }
      }
      const content = characters.slice(start, end).join("").trim();
      if (content) {
        chunks.push({
          text: content,
          pageNumber: section.pageNumber,
          sectionHeading: section.sectionHeading,
          chunkIndex: chunks.length,
          tokenCount: Math.ceil(Array.from(content).length / 4),
        });
      }
      if (end === characters.length) break;
      start = Math.max(start + 1, end - overlapCharacters);
    }
  }
  return chunks;
}
