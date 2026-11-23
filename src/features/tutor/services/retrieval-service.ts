import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chunks, materials } from "@/lib/db/schema";
import { TutorError } from "../tutor-error";
import { MAX_QUESTION_CHARACTERS, type RetrievedSource } from "../schemas/tutor";
import { z } from "zod";

export const MAX_RETRIEVED_CHUNKS = 6;
export const MAX_CONTEXT_CHARACTERS = 18_000;

export async function requireTutorMaterial({ materialId, userId }: { materialId: string; userId: string }) {
  const [material] = await db.select({ status: materials.status }).from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.userId, userId))).limit(1);
  if (!material) throw new TutorError("NOT_FOUND", "Material not found or access denied.");
  if (material.status !== "ready") throw new TutorError("NOT_READY", "Wait for document analysis to finish before asking questions.");
}

export async function retrieveSources({ materialId, userId, question }: {
  materialId: string; userId: string; question: string;
}): Promise<RetrievedSource[]> {
  const parsed = z.string().trim().min(1).max(MAX_QUESTION_CHARACTERS * 2 + 1).safeParse(question);
  if (!parsed.success) throw new TutorError("INVALID_INPUT", "Enter a shorter, non-empty question.");
  await requireTutorMaterial({ materialId, userId });
  // OR the normalized lexemes so natural-language questions don't require every word.
  // The expression exactly matches the existing English GIN index; values stay parameterized.
  const query = sql`replace(plainto_tsquery('english', ${parsed.data})::text, ' & ', ' | ')::tsquery`;
  const vector = sql`to_tsvector('english', ${chunks.content})`;
  const rank = sql<number>`ts_rank_cd(${vector}, ${query})`;
  const rows = await db.select({ chunkId: chunks.id, content: chunks.content,
    pageNumber: chunks.pageNumber, sectionHeading: chunks.sectionHeading,
  }).from(chunks).innerJoin(materials, eq(chunks.materialId, materials.id))
    .where(and(eq(materials.id, materialId), eq(materials.userId, userId), eq(materials.status, "ready"), sql`${vector} @@ ${query}`))
    .orderBy(desc(rank), chunks.chunkIndex).limit(MAX_RETRIEVED_CHUNKS);
  let characters = 0;
  const sources: RetrievedSource[] = [];
  for (const row of rows) {
    if (characters + row.content.length > MAX_CONTEXT_CHARACTERS) break;
    characters += row.content.length;
    sources.push(row);
  }
  return sources;
}
