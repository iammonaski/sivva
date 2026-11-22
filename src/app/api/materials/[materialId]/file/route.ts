import { createTRPCContext } from "@/server/trpc/context";
import { getMaterialDownloadUrl } from "@/features/materials/services/material.service";
import { materialErrorResponse } from "@/server/material-error-response";

export async function GET(_request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  try {
    const { session } = await createTRPCContext();
    if (!session?.user) return Response.json({ error: "Sign in to access documents." }, { status: 401 });
    const { materialId } = await params;
    const url = await getMaterialDownloadUrl({ id: materialId, userId: session.user.id });
    return new Response(null, { status: 302, headers: {
      Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    return materialErrorResponse(error);
  }
}
