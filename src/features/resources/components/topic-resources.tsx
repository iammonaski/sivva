"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ArrowSquareOut, Video } from "@phosphor-icons/react";
import { skipToken } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";

const searchOptions = {
  staleTime: 30 * 60_000,
  retry: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
} as const;

type SearchError = { data?: { code?: string } | null };

function canRetry(error: SearchError | null) {
  const code = error?.data?.code;
  return !!error && (!code || code === "SERVICE_UNAVAILABLE" || code === "INTERNAL_SERVER_ERROR" || code === "TOO_MANY_REQUESTS");
}

function SearchSkeleton({ label }: { label: string }) {
  return <div className="space-y-3" role="status" aria-label={label}>
    {[0, 1, 2].map((row) => <Skeleton key={row} className="h-24 w-full rounded-xl" />)}
  </div>;
}

function SearchMessage({ children, error = false }: { children: string; error?: boolean }) {
  return <p role={error ? "alert" : "status"} className={`rounded-xl border border-border bg-surface p-4 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>
    {children}
  </p>;
}

function ResourceLink({ title, url, destination }: { title: string; url: string; destination: string }) {
  return <a href={url} target="_blank" rel="noreferrer" className="inline-block rounded-sm text-sm font-medium wrap-anywhere text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-base">
    {title} <ArrowSquareOut aria-hidden="true" className="inline size-4" /><span className="sr-only"> (opens {destination} in a new tab)</span>
  </a>;
}

export function TopicResources({ materialId, topics }: {
  materialId: string;
  topics: { id: string; title: string }[];
}) {
  const pickerId = useId();
  const [selection, setSelection] = useState("");
  const [videoTopicId, setVideoTopicId] = useState("");
  const [paperTopicId, setPaperTopicId] = useState("");
  const topic = topics.find(({ id }) => id === selection) ?? topics[0];
  const searchedVideos = !!topic && videoTopicId === topic.id;
  const searchedPapers = !!topic && paperTopicId === topic.id;
  const videos = trpc.resources.findVideos.useQuery(searchedVideos ? { materialId, topicId: topic.id } : skipToken, searchOptions);
  const papers = trpc.resources.findPapers.useQuery(searchedPapers ? { materialId, topicId: topic.id } : skipToken, searchOptions);
  const retryVideos = canRetry(videos.error);
  const retryPapers = canRetry(papers.error);

  return <section aria-labelledby={`${pickerId}-heading`} className="space-y-5">
    <div>
      <h2 id={`${pickerId}-heading`} className="text-xl font-medium">Related resources</h2>
      <p className="mt-1 text-sm text-muted-foreground">Find YouTube lessons and open-access papers on a topic from your notes.</p>
    </div>
    {!topic ? <p className="text-sm text-muted-foreground">No topics were found in this document.</p> : <>
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor={pickerId} className="mb-1.5 block text-sm font-medium">Study topic</label>
            <select id={pickerId} value={topic.id} aria-describedby={`${pickerId}-privacy`} onChange={(event) => {
              setSelection(event.target.value);
              setVideoTopicId("");
              setPaperTopicId("");
            }} className="h-11 w-full truncate rounded-md border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:text-sm">
              {topics.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={searchedVideos && (!retryVideos || videos.isFetching)} onClick={() => {
              if (!searchedVideos) setVideoTopicId(topic.id);
              else if (retryVideos) void videos.refetch();
            }}>
              {searchedVideos && retryVideos ? "Retry lessons" : "Find lessons"}
            </Button>
            <Button type="button" variant="outline" disabled={searchedPapers && (!retryPapers || papers.isFetching)} onClick={() => {
              if (!searchedPapers) setPaperTopicId(topic.id);
              else if (retryPapers) void papers.refetch();
            }}>
              {searchedPapers && retryPapers ? "Retry papers" : "Find papers"}
            </Button>
          </div>
        </div>
        <p id={`${pickerId}-privacy`} className="text-xs leading-5 text-muted-foreground">Each search sends only the topic title to its provider (YouTube or OpenAlex), not the file or topic summary. Results are not tutor sources.</p>
      </div>
      {searchedVideos && <section aria-labelledby={`${pickerId}-videos`} className="space-y-3">
        <h3 id={`${pickerId}-videos`} className="text-lg font-medium">YouTube lessons</h3>
        {videos.isFetching && !videos.data ? <SearchSkeleton label="Finding YouTube lessons" />
          : videos.error ? <SearchMessage error>{videos.error.message}</SearchMessage>
          : videos.data?.length ? <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {videos.data.map((video) => <li key={video.id} className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
              <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-36" aria-hidden="true">
                <Video className="absolute inset-0 m-auto size-5 text-muted-foreground" />
                <Image src={video.thumbnail} alt="" fill sizes="(min-width: 640px) 144px, 96px" className="object-cover text-transparent" />
              </div>
              <div className="min-w-0 space-y-1">
                <ResourceLink title={video.title} url={video.url} destination="YouTube" />
                <p className="text-xs wrap-anywhere text-muted-foreground sm:text-sm">{video.channel}</p>
                <p className="text-xs leading-5 wrap-anywhere text-muted-foreground sm:text-sm">{video.reason}</p>
              </div>
            </li>)}
          </ul> : videos.data && <SearchMessage>No matching lessons were found. Try another topic.</SearchMessage>}
      </section>}
      {searchedPapers && <section aria-labelledby={`${pickerId}-papers`} className="space-y-3">
        <h3 id={`${pickerId}-papers`} className="text-lg font-medium">Open-access papers</h3>
        {papers.isFetching && !papers.data ? <SearchSkeleton label="Finding papers on OpenAlex" />
          : papers.error ? <SearchMessage error>{papers.error.message}</SearchMessage>
          : papers.data?.length ? <>
            <p className="text-sm text-muted-foreground">Found via OpenAlex. Select a title to read the paper.</p>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {papers.data.map((paper) => <li key={paper.id} className="space-y-1 p-4 sm:p-5">
                <ResourceLink title={paper.title} url={paper.url} destination="the paper" />
                {paper.year !== null && <p className="text-xs text-muted-foreground">Published in {paper.year}</p>}
                <p className="text-xs leading-5 wrap-anywhere text-muted-foreground sm:text-sm">{paper.reason}</p>
              </li>)}
            </ul>
          </> : papers.data && <SearchMessage>No matching open-access papers were found. Try another topic.</SearchMessage>}
      </section>}
    </>}
  </section>;
}
