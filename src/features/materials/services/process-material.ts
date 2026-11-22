import "server-only";
import { processDocument } from "@/features/documents/services/document-service";
import { analyzeDocument } from "@/features/analysis/services/analysis-service";
import type { MaterialFileType } from "../schemas/material";

// The transport schedules this workflow; feature services own the stage ordering.
export async function processMaterial(input: {
  materialId: string; userId: string; buffer: Buffer; fileType: MaterialFileType;
}) {
  await processDocument(input);
  await analyzeDocument({ id: input.materialId, userId: input.userId });
}
