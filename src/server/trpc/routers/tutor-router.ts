import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { TutorError } from "@/features/tutor/tutor-error";
import { conversationInputSchema } from "@/features/tutor/schemas/tutor";
import { getConversation, listConversations } from "@/features/tutor/services/tutor-service";
import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../middleware";

function mapTutorError(error: unknown): never {
  if (error instanceof TutorError) {
    throw new TRPCError({ code: error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "NOT_READY" ? "CONFLICT" : "INTERNAL_SERVER_ERROR", message: error.message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The conversation could not be read." });
}
export const tutorRouter = createTRPCRouter({
  listConversations: protectedProcedure.input(z.strictObject({ materialId: z.uuid() })).query(async ({ ctx, input }) => {
    try { return await listConversations({ ...input, userId: ctx.user.id }); }
    catch (error) { mapTutorError(error); }
  }),
  getConversation: protectedProcedure.input(conversationInputSchema).query(async ({ ctx, input }) => {
    try { return await getConversation({ ...input, userId: ctx.user.id }); }
    catch (error) { mapTutorError(error); }
  }),
});
