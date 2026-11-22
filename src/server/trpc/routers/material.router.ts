import { TRPCError } from "@trpc/server";
import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../middleware";
import { listUserMaterials, getMaterialById, getMaterialStatus, deleteMaterial } from "@/features/materials/services/material.service";
import { materialIdSchema } from "@/features/materials/schemas/material";
import { MaterialError } from "@/features/materials/material-error";

function mapMaterialError(error: unknown): never {
  if (error instanceof MaterialError) {
    throw new TRPCError({ code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message: error.message, cause: error });
  }
  throw error;
}

export const materialRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => listUserMaterials({ userId: ctx.user.id })),
  getById: protectedProcedure.input(materialIdSchema).query(async ({ ctx, input }) => {
    const material = await getMaterialById({ id: input.id, userId: ctx.user.id });
    if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "Material not found or access denied." });
    return material;
  }),
  getStatus: protectedProcedure.input(materialIdSchema).query(async ({ ctx, input }) => {
    try { return await getMaterialStatus({ id: input.id, userId: ctx.user.id }); }
    catch (error) { mapMaterialError(error); }
  }),
  delete: protectedProcedure.input(materialIdSchema).mutation(async ({ ctx, input }) => {
    try {
      const deleted = await deleteMaterial({ id: input.id, userId: ctx.user.id });
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Material not found or already deleted." });
      return { success: true, id: deleted.id };
    } catch (error) { mapMaterialError(error); }
  }),
});
