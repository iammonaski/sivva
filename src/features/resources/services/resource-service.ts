import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materials, topics } from "@/lib/db/schema";
import { ResourceError } from "../resource-error";
import { searchYouTube } from "./youtube";
import { searchOpenAlex } from "./openalex";

type OwnedTopic = { materialId: string; topicId: string; userId: string };

async function getOwnedTopicTitle({ materialId, topicId, userId }: OwnedTopic) {
  const [topic] = await db.select({ title: topics.title }).from(topics)
    .innerJoin(materials, eq(topics.materialId, materials.id))
    .where(and(
      eq(topics.id, topicId), eq(materials.id, materialId),
      eq(materials.userId, userId), eq(materials.status, "ready"),
    )).limit(1);
  if (!topic) throw new ResourceError("NOT_FOUND", "Topic not found or access denied.");

  return topic.title;
}

export async function findTopicVideos(input: OwnedTopic) {
  return searchYouTube(await getOwnedTopicTitle(input));
}

export async function findTopicPapers(input: OwnedTopic) {
  return searchOpenAlex(await getOwnedTopicTitle(input));
}
