import { after } from "next/server";
import { createTRPCContext } from "@/server/trpc/context";
import { createMaterial } from "@/features/materials/services/material.service";
import { processMaterial } from "@/features/materials/services/process-material";
import { uploadResponseSchema } from "@/features/materials/schemas/material";
import { readUploadForm } from "@/features/materials/services/upload-validation";
import { materialErrorResponse } from "@/server/material-error-response";
import { env } from "@/lib/env";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    // Multipart endpoints need their own CSRF check: browsers send Origin.
    if (request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin) {
      return Response.json({ error: "Upload from this application's library." }, { status: 403 });
    }
    const { session } = await createTRPCContext();
    if (!session?.user) return Response.json({ error: "Sign in to upload documents." }, { status: 401 });
    const { file, title } = await readUploadForm(request);
    const created = await createMaterial({ userId: session.user.id, file, title });
    after(() => processMaterial({
      materialId: created.materialId, userId: session.user.id, buffer: created.buffer, fileType: created.fileType,
    }));
    return Response.json(uploadResponseSchema.parse(created), { status: 202 });
  } catch (error) {
    return materialErrorResponse(error);
  }
}
