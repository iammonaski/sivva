import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { materials, topics } from "@/lib/db/schema";

const lecture = {
  id: materials.id, title: materials.title, fileName: materials.fileName,
  fileType: materials.fileType, status: materials.status, createdAt: materials.createdAt,
};

export async function getDashboardStats({ userId }: { userId: string }) {
  const owned = eq(materials.userId, userId);
  const [[totals], recentMaterials, [studyLecture]] = await Promise.all([
    db.select({ total: count() }).from(materials).where(owned),
    db.select(lecture).from(materials).where(owned)
      .orderBy(desc(materials.createdAt), desc(materials.id)).limit(5),
    db.select({ ...lecture, lastOpenedAt: materials.lastOpenedAt, lastStudyTab: materials.lastStudyTab, lastTopicId: topics.id, resumeTopic: topics.title }).from(materials)
      .leftJoin(topics, and(eq(topics.id, materials.lastTopicId), eq(topics.materialId, materials.id)))
      .where(and(owned, eq(materials.status, "ready")))
      .orderBy(sql`${materials.lastOpenedAt} desc nulls last`, desc(materials.createdAt), desc(materials.id)).limit(1),
  ]);
  const latest = recentMaterials[0];
  const featured = studyLecture ?? (latest && { ...latest, lastOpenedAt: null, lastStudyTab: null, lastTopicId: null, resumeTopic: null });
  const outline = featured?.status === "ready"
    ? await db.select({ id: topics.id, title: topics.title }).from(topics)
        .where(eq(topics.materialId, featured.id)).orderBy(asc(topics.order), asc(topics.id)).limit(3)
    : [];
  return { totalMaterials: totals.total, recentMaterials, featured: featured ? { ...featured, outline } : null };
}

export async function searchLectures({ userId, query }: { userId: string; query: string }) {
  // Treat wildcard characters in filenames as literal text, not search operators.
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db.select(lecture).from(materials).where(and(eq(materials.userId, userId),
    or(ilike(materials.title, pattern), ilike(materials.fileName, pattern))))
    .orderBy(desc(materials.createdAt), desc(materials.id)).limit(9);
  return { items: rows.slice(0, 8), hasMore: rows.length > 8 };
}
