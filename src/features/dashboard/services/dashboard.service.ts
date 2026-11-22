import { db } from "@/lib/db";
import { materials, topics } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

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
    .orderBy(materials.createdAt)
    .limit(5);

  return {
    totalMaterials: materialCountResult?.value ?? 0,
    totalTopics,
    recentMaterials,
  };
}
