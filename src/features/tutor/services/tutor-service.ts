import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, materials } from "@/lib/db/schema";
import type { ConversationMessage } from "@/lib/db/schema/conversations";
import { streamTutorAnswer } from "@/lib/ai/gemini-tutor";
import { TutorError } from "../tutor-error";
import { citationSchema, messagesSchema, tutorAnswerSchema, tutorRequestSchema, type RetrievedSource, type TutorAnswer, type TutorEvent } from "../schemas/tutor";
import { requireTutorMaterial, retrieveSources } from "./retrieval-service";

export function validateTutorAnswer({ answer, sources }: { answer: TutorAnswer; sources: RetrievedSource[] }) {
  const parsed = tutorAnswerSchema.safeParse(answer);
  if (!parsed.success) throw new TutorError("INVALID_OUTPUT", "The tutor returned an invalid answer. Please try again.");
  const ids = parsed.data.sourceIds;
  const markers = [...new Set([...parsed.data.answer.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]))];
  if (new Set(ids).size !== ids.length || ids.some((id) => !sources[Number(id.slice(1)) - 1]) ||
    markers.length !== ids.length || markers.some((id) => !ids.includes(id)) ||
    (parsed.data.grounding === "source-grounded" ? ids.length === 0 : ids.length !== 0)) {
    throw new TutorError("INVALID_OUTPUT", "The tutor returned invalid source references. Please try again.");
  }
  return ids.map((sourceId) => {
    const source = sources[Number(sourceId.slice(1)) - 1];
    return citationSchema.parse({ sourceId, chunkId: source.chunkId, text: source.content,
      ...(source.pageNumber !== null ? { pageNumber: source.pageNumber } : {}),
      ...(source.sectionHeading !== null ? { sectionHeading: source.sectionHeading } : {}),
    });
  });
}

export async function listConversations(input: { materialId: string; userId: string }) {
  await requireTutorMaterial(input);
  return db.select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations).innerJoin(materials, eq(conversations.materialId, materials.id))
    .where(and(eq(materials.id, input.materialId), eq(materials.userId, input.userId), eq(conversations.userId, input.userId)))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversation({ materialId, userId, conversationId }: { materialId: string; userId: string; conversationId: string }) {
  await requireTutorMaterial({ materialId, userId });
  const [conversation] = await db.select({ id: conversations.id, title: conversations.title,
    messages: conversations.messages, updatedAt: conversations.updatedAt,
  }).from(conversations).innerJoin(materials, eq(conversations.materialId, materials.id))
    .where(and(eq(materials.id, materialId), eq(materials.userId, userId), eq(conversations.userId, userId), eq(conversations.id, conversationId))).limit(1);
  if (!conversation) throw new TutorError("NOT_FOUND", "Conversation not found or access denied.");
  const parsed = messagesSchema.safeParse(conversation.messages);
  if (!parsed.success) throw new TutorError("PERSISTENCE_ERROR", "The conversation could not be read.");
  return { ...conversation, messages: parsed.data };
}

function promptHistory(messages: ConversationMessage[]) {
  const history: ConversationMessage[] = [];
  let characters = 0;
  // Bound history without truncating a message or splitting a completed exchange.
  for (let index = messages.length - 2; index >= Math.max(0, messages.length - 6); index -= 2) {
    const pair = messages.slice(index, index + 2);
    characters += pair.reduce((sum, message) => sum + message.content.length, 0);
    if (characters > 12_000) break;
    history.unshift(...pair);
  }
  return history;
}

export async function prepareTutorTurn({ materialId, userId, question, conversationId, signal }: {
  materialId: string; userId: string; question: string; conversationId?: string; signal: AbortSignal;
}): Promise<AsyncGenerator<TutorEvent>> {
  const parsed = tutorRequestSchema.safeParse({ question, conversationId });
  if (!parsed.success) throw new TutorError("INVALID_INPUT", "Enter a question of 1–2,000 characters and a valid conversation ID.");
  question = parsed.data.question;
  await requireTutorMaterial({ materialId, userId });
  const existing = conversationId ? await getConversation({ materialId, userId, conversationId }) : null;
  const messages = existing?.messages ?? [];
  if (messages.length >= 100) throw new TutorError("CONFLICT", "This conversation is full. Start a new conversation.");
  // The previous user question helps lexical retrieval resolve short follow-ups.
  const lastQuestion = messages.findLast((message) => message.role === "user")?.content;
  const sources = await retrieveSources({ materialId, userId, question: lastQuestion ? `${question}\n${lastQuestion}` : question });
  if (signal.aborted) throw new TutorError("CANCELLED", "The tutor request was cancelled.");
  return completeTurn();

  async function* completeTurn(): AsyncGenerator<TutorEvent> {
    let answer: TutorAnswer = { answer: "The uploaded material does not provide enough information to answer this question. Try naming a topic or term from your notes.", sourceIds: [], grounding: "unsupported" };
    if (sources.length) {
      let completed = false;
      for await (const event of streamTutorAnswer({ question, history: promptHistory(messages), sources, signal })) {
        if (signal.aborted) throw new TutorError("CANCELLED", "The tutor request was cancelled.");
        if (event.type === "delta") yield event;
        else { answer = event.answer; completed = true; }
      }
      if (!completed) throw new TutorError("INVALID_OUTPUT", "The tutor returned an incomplete answer. Please try again.");
    } else {
      yield { type: "delta", text: answer.answer };
    }
    const citations = validateTutorAnswer({ answer, sources });
    const createdAt = new Date().toISOString();
    const assistant = { id: crypto.randomUUID(), role: "assistant" as const, content: answer.answer, citations, grounding: answer.grounding, createdAt };
    const exchange = [{ id: crypto.randomUUID(), role: "user" as const, content: question, createdAt }, assistant];
    const nextMessages = messagesSchema.parse([...messages, ...exchange]);
    const id = conversationId ?? crypto.randomUUID();
    try {
      await db.transaction(async (tx) => {
        // No locks across provider calls. Serialize saves with deletion and other
        // turns, then reject a stale history instead of overwriting an exchange.
        const [material] = await tx.select({ status: materials.status }).from(materials)
          .where(and(eq(materials.id, materialId), eq(materials.userId, userId))).for("update");
        if (!material) throw new TutorError("NOT_FOUND", "The material was deleted before the answer could be saved.");
        if (material.status !== "ready") throw new TutorError("NOT_READY", "The material is no longer ready for questions.");
        if (signal.aborted) throw new TutorError("CANCELLED", "The tutor request was cancelled.");
        if (existing) {
          const owned = and(eq(conversations.id, id), eq(conversations.materialId, materialId), eq(conversations.userId, userId));
          const [current] = await tx.select({ messages: conversations.messages }).from(conversations).where(owned).for("update");
          if (!current) throw new TutorError("NOT_FOUND", "Conversation not found or access denied.");
          // Parse both histories into canonical key order: PostgreSQL JSONB
          // does not preserve the object-key ordering of the original input.
          const canonical = messagesSchema.safeParse(current.messages);
          if (!canonical.success || JSON.stringify(canonical.data) !== JSON.stringify(messages))
            throw new TutorError("CONFLICT", "This conversation changed while answering. Reload it and try again.");
          await tx.update(conversations).set({ messages: nextMessages, updatedAt: new Date() }).where(owned);
        } else {
          await tx.insert(conversations).values({ id, materialId, userId, title: question.slice(0, 80), messages: nextMessages });
        }
      });
    } catch (cause) {
      if (cause instanceof TutorError) throw cause;
      throw new TutorError("PERSISTENCE_ERROR", "The answer could not be saved. Please try again.", { cause });
    }
    yield { type: "done", conversationId: id, message: assistant };
  }
}
