import "server-only";
import { Parser } from "htmlparser2";
import { z } from "zod";
import { env } from "@/lib/env";
import { ResourceError } from "../resource-error";
import { topicMatcher } from "./topic-match";

const searchResultSchema = z.object({
  id: z.object({ videoId: z.string().regex(/^[\w-]{11}$/) }),
  snippet: z.object({
    title: z.string().trim().min(1),
    channelTitle: z.string().trim().min(1),
    description: z.string(),
  }),
});
const searchResponseSchema = z.object({ items: z.array(z.unknown()).max(12) });
const errorResponseSchema = z.object({
  error: z.object({ errors: z.array(z.object({ reason: z.string() })) }),
});
function decodeText(value: string) {
  let text = "";
  new Parser({ ontext: (part) => { text += part; } }).end(value.replaceAll("<", "&lt;"));
  return text;
}

const unavailable = () => new ResourceError("UNAVAILABLE", "YouTube search is unavailable right now. Try again in a moment.");

export async function searchYouTube(topicTitle: string) {
  if (!env.YOUTUBE_API_KEY) {
    throw new ResourceError("NOT_CONFIGURED", "YouTube search hasn’t been set up for this deployment.");
  }

  const match = topicMatcher(topicTitle);
  if (!match) return [];

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    order: "relevance",
    safeSearch: "strict",
    maxResults: "12",
    q: `${topicTitle} tutorial`,
    fields: "items(id/videoId,snippet(title,channelTitle,description))",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "x-goog-api-key": env.YOUTUBE_API_KEY },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw unavailable();
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = errorResponseSchema.safeParse(body);
    if (response.status === 429 || (error.success && error.data.error.errors.some(({ reason }) =>
      ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(reason)))) {
      throw new ResourceError("QUOTA_EXCEEDED", "YouTube’s search limit has been reached. Try again later.");
    }
    throw unavailable();
  }

  const parsed = searchResponseSchema.safeParse(body);
  if (!parsed.success) throw unavailable();
  const videos = new Map<string, { id: string; title: string; channel: string; reason: string; titleMatch: boolean }>();
  let validResults = 0;

  for (const item of parsed.data.items) {
    const video = searchResultSchema.safeParse(item);
    if (!video.success) continue;
    validResults++;
    const { id: { videoId: id }, snippet } = video.data;
    if (videos.has(id)) continue;
    const title = decodeText(snippet.title);
    const titleMatch = match(title);
    const matches = titleMatch ?? match(decodeText(snippet.description));
    if (!matches) continue;

    videos.set(id, {
      id,
      title,
      channel: decodeText(snippet.channelTitle),
      reason: `The video ${titleMatch ? "title" : "description"} mentions ${matches}.`,
      titleMatch: titleMatch !== null,
    });
  }
  if (!validResults && parsed.data.items.length) throw unavailable();

  return [...videos.values()]
    .sort((a, b) => Number(b.titleMatch) - Number(a.titleMatch))
    .slice(0, 5)
    .map(({ id, title, channel, reason }) => ({
      id, title, channel, reason,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    }));
}
