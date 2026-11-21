import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../middleware";
import { getDashboardStats } from "@/features/dashboard/services/dashboard.service";

export const dashboardRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return getDashboardStats({ userId: ctx.user.id });
  }),
});
