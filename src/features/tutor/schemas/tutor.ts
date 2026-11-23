import { z } from "zod";

export const MAX_QUESTION_CHARACTERS = 2_000;
export const MAX_ANSWER_CHARACTERS = 16_000;
export const tutorRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARACTERS),
  conversationId: z.uuid().optional(),
});
export const conversationInputSchema = z.strictObject({ materialId: z.uuid(), conversationId: z.uuid() });
export const citationSchema = z.strictObject({
  sourceId: z.string().regex(/^S[1-6]$/), chunkId: z.uuid(),
  pageNumber: z.number().int().positive().optional(),
  sectionHeading: z.string().optional(), text: z.string().max(8_000),
});
export const messageSchema = z.strictObject({
  id: z.uuid(), role: z.enum(["user", "assistant"]), content: z.string().min(1).max(MAX_ANSWER_CHARACTERS),
  citations: z.array(citationSchema).max(6).optional(),
  grounding: z.enum(["source-grounded", "unsupported"]).optional(), createdAt: z.iso.datetime(),
});
export const messagesSchema = z.array(messageSchema).max(100);
export const tutorAnswerSchema = z.strictObject({
  answer: z.string().min(1).max(MAX_ANSWER_CHARACTERS),
  sourceIds: z.array(z.string().regex(/^S[1-6]$/)).max(6),
  grounding: z.enum(["source-grounded", "unsupported"]),
});
export const tutorEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("delta"), text: z.string() }),
  z.strictObject({ type: z.literal("done"), conversationId: z.uuid(), message: messageSchema }),
  z.strictObject({ type: z.literal("error"), code: z.string(), error: z.string() }),
]);
export type TutorAnswer = z.infer<typeof tutorAnswerSchema>;
export type TutorEvent = z.infer<typeof tutorEventSchema>;
export type RetrievedSource = { chunkId: string; content: string; pageNumber: number | null; sectionHeading: string | null };
