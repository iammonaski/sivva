import { db } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function listUserMaterials({ userId }: { userId: string }) {
  return db
    .select()
    .from(materials)
    .where(eq(materials.userId, userId))
    .orderBy(desc(materials.createdAt));
}

export async function getMaterialById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [material] = await db
    .select()
    .from(materials)
    .where(and(eq(materials.id, id), eq(materials.userId, userId)))
    .limit(1);

  return material ?? null;
}

export async function deleteMaterial({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [deleted] = await db
    .delete(materials)
    .where(and(eq(materials.id, id), eq(materials.userId, userId)))
    .returning();

  return deleted ?? null;
}
