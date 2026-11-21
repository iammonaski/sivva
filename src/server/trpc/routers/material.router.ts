import { z } from "zod";
import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../middleware";
import {
  listUserMaterials,
  getMaterialById,
  deleteMaterial,
} from "@/features/materials/services/material.service";
import { TRPCError } from "@trpc/server";

export const materialRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listUserMaterials({ userId: ctx.user.id });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const material = await getMaterialById({
        id: input.id,
        userId: ctx.user.id,
      });

      if (!material) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Material not found or access denied.",
        });
      }

      return material;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteMaterial({
        id: input.id,
        userId: ctx.user.id,
      });

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Material not found or already deleted.",
        });
      }

      return { success: true, id: deleted.id };
    }),
});
