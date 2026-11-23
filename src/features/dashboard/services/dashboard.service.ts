import { db } from "@/lib/db";
import { materials, topics, studyGuides } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";

export async function getDashboardStats({ userId }: { userId: string }) {
  const [materialCountResult] = await db
    .select({ value: count() })
    .from(materials)
    .where(eq(materials.userId, userId));

  const [topicCountResult] = await db
    .select({ value: count() })
    .from(topics)
    .innerJoin(materials, eq(topics.materialId, materials.id))
    .where(eq(materials.userId, userId));
  const totalTopics = topicCountResult?.value ?? 0;
  const [guideCountResult] = await db
    .select({ value: count() })
    .from(studyGuides)
    .innerJoin(materials, eq(studyGuides.materialId, materials.id))
    .where(eq(materials.userId, userId));

  const recentMaterials = await db
    .select({
      id: materials.id,
      title: materials.title,
      fileName: materials.fileName,
      fileType: materials.fileType,
      fileSize: materials.fileSize,
      status: materials.status,
      createdAt: materials.createdAt,
    })
    .from(materials)
    .where(eq(materials.userId, userId))
    .orderBy(desc(materials.createdAt), desc(materials.id))
    .limit(5);

  return {
    totalMaterials: materialCountResult?.value ?? 0,
    totalTopics,
    totalStudyGuides: guideCountResult?.value ?? 0,
    recentMaterials,
  };
}
