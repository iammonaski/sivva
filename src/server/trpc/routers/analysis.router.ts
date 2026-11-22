import { TRPCError } from "@trpc/server";
import { AnalysisError } from "@/features/analysis/analysis-error";
import { getOverview, getStudyGuide, getTopics } from "@/features/analysis/services/analysis-service";
import { materialIdSchema } from "@/features/materials/schemas/material";
import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../middleware";

function mapAnalysisError(error: unknown): never {
  if (error instanceof AnalysisError) {
    throw new TRPCError({ code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message: error.message });
  }
  throw error;
}

export const analysisRouter = createTRPCRouter({
  getOverview: protectedProcedure.input(materialIdSchema).query(async ({ ctx, input }) => {
    try { return await getOverview({ id: input.id, userId: ctx.user.id }); }
    catch (error) { mapAnalysisError(error); }
  }),
  getTopics: protectedProcedure.input(materialIdSchema).query(async ({ ctx, input }) => {
    try { return await getTopics({ id: input.id, userId: ctx.user.id }); }
    catch (error) { mapAnalysisError(error); }
  }),
  getStudyGuide: protectedProcedure.input(materialIdSchema).query(async ({ ctx, input }) => {
    try { return await getStudyGuide({ id: input.id, userId: ctx.user.id }); }
    catch (error) { mapAnalysisError(error); }
  }),
});
