import { db } from "@/lib/db";
import { materials, topics } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function getDashboardStats({ userId }: { userId: string }) {
  const [materialCountResult] = await db
    .select({ value: count() })
    .from(materials)
    .where(eq(materials.userId, userId));

  const userMaterials = await db
    .select({ id: materials.id })
    .from(materials)
    .where(eq(materials.userId, userId));

  const materialIds = userMaterials.map((m) => m.id);

  let totalTopics = 0;
  if (materialIds.length > 0) {
    const topicCountResults = await db
      .select({ value: count() })
      .from(topics);
    totalTopics = topicCountResults[0]?.value ?? 0;
  }

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
