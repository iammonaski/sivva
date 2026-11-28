import { z } from "zod";

// Stay below Vercel's 4.5 MB request limit, allowing room for multipart headers.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const fileTypeSchema = z.enum(["pdf", "docx"]);
export type MaterialFileType = z.infer<typeof fileTypeSchema>;
export const materialIdSchema = z.object({ id: z.string().min(1).max(200) });
export const studyTabSchema = z.enum(["overview", "topics", "guide", "ask", "resources"]);
export const studyPositionSchema = materialIdSchema.extend({
  tab: studyTabSchema.default("overview"), topicId: z.string().min(1).max(200).nullable().default(null),
});
export const uploadResponseSchema = z.object({
  materialId: z.string().min(1),
  status: z.literal("processing"),
});
export const uploadErrorSchema = z.object({ error: z.string() });
export const uploadMetadataSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_BYTES),
  fileType: fileTypeSchema,
  title: z.string().trim().min(1).max(200),
});
