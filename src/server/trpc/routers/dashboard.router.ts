import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../middleware";
import { z } from "zod";
import { getDashboardStats, searchLectures } from "@/features/dashboard/services/dashboard.service";

export const dashboardRouter = createTRPCRouter({
  search: protectedProcedure.input(z.object({ query: z.string().trim().min(1).max(255) }))
    .query(({ ctx, input }) => searchLectures({ userId: ctx.user.id, query: input.query })),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return getDashboardStats({ userId: ctx.user.id });
  }),
});
