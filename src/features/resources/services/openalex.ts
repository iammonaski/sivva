import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { ResourceError } from "../resource-error";
import { topicMatcher } from "./topic-match";

const workSchema = z.object({
  id: z.string().regex(/^https:\/\/openalex\.org\/W\d+$/),
  title: z.string().trim().min(1).nullable(),
  publication_year: z.number().int().nullable(),
  type: z.string(),
  open_access: z.object({ is_oa: z.boolean(), oa_url: z.string().nullable() }),
  abstract_inverted_index: z.record(z.string(), z.array(z.number().int().nonnegative())).nullish(),
});
const responseSchema = z.object({ results: z.array(z.unknown()).max(12) });
const readUrlSchema = z.url({ protocol: /^https$/ }).refine((url) => {
  const { username, password } = new URL(url);
  return !username && !password;
});

const unavailable = () => new ResourceError("UNAVAILABLE", "OpenAlex search is unavailable right now. Try again in a moment.");

export async function searchOpenAlex(topicTitle: string) {
  const match = topicMatcher(topicTitle);
  if (!match) return [];

  const url = new URL("https://api.openalex.org/works");
  url.search = new URLSearchParams({
    search: topicTitle,
    filter: "is_oa:true,type:article|review",
    per_page: "12",
    select: "id,title,publication_year,type,open_access,abstract_inverted_index",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: env.OPENALEX_API_KEY ? { Authorization: `Bearer ${env.OPENALEX_API_KEY}` } : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw unavailable();
  }
  if (response.status === 429) {
    throw new ResourceError("QUOTA_EXCEEDED", "OpenAlex’s search limit has been reached. Try again later.");
  }
  if (!response.ok) throw unavailable();

  const body: unknown = await response.json().catch(() => null);
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw unavailable();

  const papers = new Map<string, { id: string; title: string; year: number | null; url: string; reason: string }>();
  const seenUrls = new Set<string>();
  let validResults = 0;
  for (const item of parsed.data.results) {
    const result = workSchema.safeParse(item);
    if (!result.success) continue;
    validResults++;
    const work = result.data;
    if (!work.title || !work.open_access.is_oa || (work.type !== "article" && work.type !== "review")) continue;
    const link = readUrlSchema.safeParse(work.open_access.oa_url);
    if (!link.success || papers.has(work.id) || seenUrls.has(link.data)) continue;
    const titleMatch = match(work.title);
    // OpenAlex indexes each distinct abstract word as a key; term overlap doesn't need word order.
    const matches = titleMatch ?? match(Object.keys(work.abstract_inverted_index ?? {}).join(" "));
    if (!matches) continue;

    papers.set(work.id, {
      id: work.id,
      title: work.title,
      year: work.publication_year,
      url: link.data,
      reason: `The ${titleMatch ? "title" : "abstract"} mentions ${matches}.`,
    });
    seenUrls.add(link.data);
    if (papers.size === 5) break;
  }
  if (!validResults && parsed.data.results.length) throw unavailable();
  return [...papers.values()];
}
