import { createTRPCRouter, publicProcedure } from "../init";
import { dashboardRouter } from "./dashboard.router";
import { materialRouter } from "./material.router";
import { analysisRouter } from "./analysis.router";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }),
  dashboard: dashboardRouter,
  material: materialRouter,
  analysis: analysisRouter,
});

export type AppRouter = typeof appRouter;
