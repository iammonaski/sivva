import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, materials, studyGuides, topics } from "@/lib/db/schema";
import { generateDocumentAnalysis } from "@/lib/ai/gemini";
import { analysisSchema } from "@/lib/ai/schemas/document-analysis";
import { AnalysisError } from "../analysis-error";

type OwnedMaterialInput = { id: string; userId: string };

export async function analyzeDocument({ id, userId }: OwnedMaterialInput): Promise<void> {
  const owned = and(eq(materials.id, id), eq(materials.userId, userId));
  // Atomic claim: only one invocation may call Gemini. No lock held over network I/O.
  const [claimed] = await db.update(materials).set({
    status: "analyzing", errorMessage: null, updatedAt: new Date(),
  }).where(and(owned, eq(materials.status, "extracted"))).returning({ id: materials.id });
  if (!claimed) return;
  const ownedAnalyzing = and(owned, eq(materials.status, "analyzing"));
  try {
    const [document] = await db.select({ rawText: documents.rawText }).from(documents)
      .innerJoin(materials, eq(documents.materialId, materials.id))
      .where(ownedAnalyzing).limit(1);
    if (!document) throw new AnalysisError("NOT_FOUND", "Extracted document not found.");
    // Validate at the service boundary too; persistence must never trust an adapter.
    const result = analysisSchema.safeParse(await generateDocumentAnalysis({ rawText: document.rawText }));
    if (!result.success) throw new AnalysisError("INVALID_OUTPUT", "AI analysis returned an invalid study guide. Please try uploading again later.");
    await db.transaction(async (tx) => {
      // Serialize with deletion; an obsolete result cannot resurrect a material.
      const [material] = await tx.select({ id: materials.id }).from(materials)
        .where(ownedAnalyzing).for("update");
      if (!material) return;
      await tx.delete(topics).where(eq(topics.materialId, id));
      await tx.delete(studyGuides).where(eq(studyGuides.materialId, id));
      await tx.insert(topics).values(result.data.topics.map((topic, order) => ({ ...topic, materialId: id, order })));
      await tx.insert(studyGuides).values({ ...result.data.studyGuide, materialId: id });
      await tx.update(materials).set({ status: "ready", errorMessage: null, updatedAt: new Date() }).where(ownedAnalyzing);
    });
  } catch (cause) {
    const error = cause instanceof AnalysisError ? cause : new AnalysisError("PERSISTENCE_ERROR", "The study guide could not be saved. Please delete the document and upload again.");
    // Log the category only: provider/validation errors may contain private source text.
    console.error("Document analysis failed", error.code);
    await db.update(materials).set({ status: "error", errorMessage: error.message, updatedAt: new Date() }).where(ownedAnalyzing);
  }
}

export async function getStudyGuide({ id, userId }: OwnedMaterialInput) {
  const owned = and(eq(materials.id, id), eq(materials.userId, userId));
  const [material] = await db.select({ id: materials.id }).from(materials).where(owned).limit(1);
  if (!material) throw new AnalysisError("NOT_FOUND", "Material not found or access denied.");
  const [guide] = await db.select({
    overview: studyGuides.overview, keyConcepts: studyGuides.keyConcepts, keyTerms: studyGuides.keyTerms,
  }).from(studyGuides).innerJoin(materials, eq(studyGuides.materialId, materials.id))
    .where(and(owned, eq(materials.status, "ready"))).limit(1);
  return guide ?? null;
}

export async function getOverview(input: OwnedMaterialInput) {
  const guide = await getStudyGuide(input);
  return guide ? { overview: guide.overview } : null;
}

export async function getTopics({ id, userId }: OwnedMaterialInput) {
  const owned = and(eq(materials.id, id), eq(materials.userId, userId));
  const [material] = await db.select({ id: materials.id }).from(materials).where(owned).limit(1);
  if (!material) throw new AnalysisError("NOT_FOUND", "Material not found or access denied.");
  return db.select({ id: topics.id, title: topics.title, summary: topics.summary, order: topics.order })
    .from(topics).innerJoin(materials, eq(topics.materialId, materials.id))
    .where(and(owned, eq(materials.status, "ready"))).orderBy(topics.order);
}
