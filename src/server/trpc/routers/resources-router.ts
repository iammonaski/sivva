import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ResourceError } from "@/features/resources/resource-error";
import { findTopicPapers, findTopicVideos } from "@/features/resources/services/resource-service";
import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../middleware";

const errorCodes = {
  NOT_FOUND: "NOT_FOUND",
  NOT_CONFIGURED: "PRECONDITION_FAILED",
  UNAVAILABLE: "SERVICE_UNAVAILABLE",
  QUOTA_EXCEEDED: "TOO_MANY_REQUESTS",
} as const;

function mapResourceError(error: unknown): never {
  if (error instanceof ResourceError) {
    throw new TRPCError({ code: errorCodes[error.code], message: error.message });
  }
  throw error;
}

const topicProcedure = protectedProcedure.input(z.object({
  materialId: z.string().min(1).max(200),
  topicId: z.uuid(),
}));

export const resourcesRouter = createTRPCRouter({
  findVideos: topicProcedure.query(({ ctx, input }) =>
    findTopicVideos({ ...input, userId: ctx.user.id }).catch(mapResourceError)),
  findPapers: topicProcedure.query(({ ctx, input }) =>
    findTopicPapers({ ...input, userId: ctx.user.id }).catch(mapResourceError)),
});
