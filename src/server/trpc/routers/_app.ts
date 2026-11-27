import { createTRPCRouter, publicProcedure } from "../init";
import { dashboardRouter } from "./dashboard.router";
import { materialRouter } from "./material.router";
import { analysisRouter } from "./analysis.router";
import { tutorRouter } from "./tutor-router";
import { resourcesRouter } from "./resources-router";

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
  tutor: tutorRouter,
  resources: resourcesRouter,
});

export type AppRouter = typeof appRouter;
