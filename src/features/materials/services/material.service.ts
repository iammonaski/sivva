import { db } from "@/lib/db";
import { materials, topics } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { deleteOriginal, getSignedOriginalUrl, uploadOriginal } from "@/lib/storage/cloudinary";
import { MaterialError } from "../material-error";
import { validateUpload } from "./upload-validation";

// Only metadata crosses the API boundary. Never expose persisted storage URLs.
const materialMetadata = {
  id: materials.id, title: materials.title, fileName: materials.fileName,
  fileType: materials.fileType, fileSize: materials.fileSize, status: materials.status,
  errorMessage: materials.errorMessage, createdAt: materials.createdAt, updatedAt: materials.updatedAt,
};

export async function listUserMaterials({ userId }: { userId: string }) {
  return db.select(materialMetadata).from(materials)
    .where(eq(materials.userId, userId)).orderBy(desc(materials.createdAt));
}

export async function getMaterialById({ id, userId }: { id: string; userId: string }) {
  const [material] = await db.select({ ...materialMetadata, lastTopicId: materials.lastTopicId }).from(materials)
    .where(and(eq(materials.id, id), eq(materials.userId, userId))).limit(1);
  return material ?? null;
}

export async function markMaterialOpened({ id, userId, tab, topicId }: {
  id: string; userId: string; tab: string; topicId: string | null;
}) {
  const ownedTopic = tab === "topics" && topicId ? db.select({ id: topics.id }).from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.materialId, id))).limit(1) : null;
  const [updated] = await db.update(materials).set({ lastOpenedAt: sql`now()`, lastStudyTab: tab,
    lastTopicId: ownedTopic ? sql`(${ownedTopic})` : null })
    .where(and(eq(materials.id, id), eq(materials.userId, userId), eq(materials.status, "ready")))
    .returning({ id: materials.id, topicId: materials.lastTopicId });
  if (!updated) throw new MaterialError("NOT_FOUND", "Material not found or access denied.");
  return updated;
}

export async function getMaterialStatus({ id, userId }: { id: string; userId: string }) {
  const material = await getMaterialById({ id, userId });
  if (!material) throw new MaterialError("NOT_FOUND", "Material not found or access denied.");
  return { id: material.id, status: material.status, errorMessage: material.errorMessage };
}

export async function createMaterial({ userId, file, title }: { userId: string; file: File; title?: string }) {
  const validated = await validateUpload({ file, title });
  const materialId = crypto.randomUUID();
  // Raw resources keep the extension. IDs contain no original filename or user identity.
  const uploaded = await uploadOriginal({ buffer: validated.buffer, storageId: `materials/${materialId}.${validated.fileType}` });
  try {
    await db.insert(materials).values({
      id: materialId, userId, title: validated.title, fileName: validated.fileName,
      fileSize: validated.fileSize, fileType: validated.fileType,
      storageId: uploaded.storageId, status: "processing",
    });
  } catch (cause) {
    try { await deleteOriginal(uploaded.storageId); }
    catch (cleanupError) { console.error("Failed to clean up unrecorded original", cleanupError); }
    throw cause;
  }
  return { materialId, status: "processing" as const, buffer: validated.buffer, fileType: validated.fileType };
}

export async function getMaterialDownloadUrl({ id, userId }: { id: string; userId: string }) {
  const [material] = await db.select({ storageId: materials.storageId }).from(materials)
    .where(and(eq(materials.id, id), eq(materials.userId, userId))).limit(1);
  if (!material) throw new MaterialError("NOT_FOUND", "Material not found or access denied.");
  return getSignedOriginalUrl(material.storageId);
}

export async function deleteMaterial({ id, userId }: { id: string; userId: string }) {
  return db.transaction(async (tx) => {
    const owned = and(eq(materials.id, id), eq(materials.userId, userId));
    const [material] = await tx.select().from(materials).where(owned).for("update");
    if (!material) return null;
    // Keep the record if cloud deletion fails so the user can retry.
    await deleteOriginal(material.storageId);
    await tx.delete(materials).where(owned);
    return { id: material.id };
  });
}
