"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BookmarkSimple, BookOpen, ChatCircleText, FileText, ListBullets, Video, WarningCircle } from "@phosphor-icons/react";
import { TopicResources } from "@/features/resources/components/topic-resources";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudyText } from "@/components/shared/study-text";
import { TutorChat } from "@/features/tutor/components/tutor-chat";

const tabs = [
  { value: "overview", label: "Overview", icon: <FileText size={18} aria-hidden="true" /> },
  { value: "topics", label: "Topics", icon: <ListBullets size={18} aria-hidden="true" /> },
  { value: "guide", label: "Study Guide", icon: <BookOpen size={18} aria-hidden="true" /> },
  { value: "ask", label: "Ask", icon: <ChatCircleText size={18} aria-hidden="true" /> },
  { value: "resources", label: "Resources", icon: <Video size={18} aria-hidden="true" /> },
] as const;
type StudyTab = (typeof tabs)[number]["value"];

export function DocumentAnalysis({ materialId, savedTopic, savingTopic, failedTopic, onRetryPosition }: {
  materialId: string; savedTopic: string | null; savingTopic: string | null; failedTopic: string | null; onRetryPosition: () => void;
}) {
  const params = useSearchParams();
  const tab: StudyTab = tabs.find((item) => item.value === params.get("tab"))?.value ?? "overview";
  const selectedTopic = params.get("topic");
  const guide = trpc.analysis.getStudyGuide.useQuery({ id: materialId });
  const topics = trpc.analysis.getTopics.useQuery({ id: materialId });
  useEffect(() => {
    if (tab !== "topics" || !selectedTopic || !topics.data?.some((topic) => topic.id === selectedTopic)) return;
    const heading = document.getElementById(`topic-${selectedTopic}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "center" });
  }, [selectedTopic, tab, topics.data]);
  const previousTopicTitle = topics.data?.find((item) => item.id === savedTopic)?.title;
  const activeQuery = tab === "topics" || tab === "resources" ? topics : guide;
  const { isLoading: loading, error } = activeQuery;

  return <Tabs value={tab} onValueChange={(value) => {
    if (!tabs.some((item) => item.value === value)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    url.searchParams.delete("topic");
    window.history.replaceState(null, "", url);
  }}>
    <TabsList variant="line" aria-label="Study workspace" className="w-full flex-wrap justify-start border-b border-border group-data-[orientation=horizontal]/tabs:h-auto">
      {tabs.map((item) => <TabsTrigger key={item.value} value={item.value} className="min-h-11 flex-none px-3 md:min-h-9 md:px-4">{item.icon}{item.label}</TabsTrigger>)}
    </TabsList>
    <TabsContent key={tab} value={tab} className="pt-6">
    {tab === "ask" ? <TutorChat materialId={materialId} /> : loading ? <section aria-busy="true" aria-label="Fetching study content" className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
    </section> : error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error.message}</p><Button variant="outline" onClick={() => void activeQuery.refetch()}>Retry</Button></div>
      : tab === "resources" ? <TopicResources materialId={materialId} topics={topics.data ?? []} />
      : tab !== "topics" && !guide.data ? <p role="alert" className="text-destructive">No study guide was found. Refresh or upload the document again.</p>
      : tab === "overview" ? <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="mb-5 text-xl font-medium">Document overview</h2>
        <StudyText text={guide.data!.overview} />
        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">Generated from your document. Check important details against the original.</p>
      </section> : tab === "topics" ? <section>
        <h2 className="text-xl font-medium">Topic outline</h2><p className="mt-1 text-sm text-muted-foreground">Follow the topics in the order they appear in your notes.</p>
        {topics.data?.length ? <ol className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface">{topics.data.map((topic, index) => <li key={topic.id} className="flex gap-4 p-5 sm:p-6">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-medium text-primary">{index + 1}</span>
          <div className="min-w-0"><h3 id={`topic-${topic.id}`} tabIndex={-1} className="mb-2 scroll-mt-20 rounded-sm text-lg font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{topic.title}</h3><StudyText text={topic.summary} />
            {savedTopic === topic.id ? <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary"><BookmarkSimple weight="fill" aria-hidden="true" />Your resume point</p>
            : failedTopic === topic.id ? <div className="mt-3 rounded-lg border border-destructive/35 bg-destructive/5 p-3">
              <div role="alert" className="flex items-start gap-2"><WarningCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="min-w-0 text-sm"><p className="font-medium">This resume point couldn’t be saved.</p>
                  {previousTopicTitle && <p className="mt-1 break-words text-muted-foreground">Your saved place is still “{previousTopicTitle}”.</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={onRetryPosition}>Retry save</Button>
            </div>
            : savingTopic === topic.id ? <Skeleton role="status" aria-label="Saving resume point" className="mt-3 h-5 w-32" />
            : <Button size="sm" variant="ghost" className="mt-2 text-primary" aria-label={`Resume here next time: ${topic.title}`} onClick={() => {
              const url = new URL(window.location.href); url.searchParams.set("topic", topic.id); window.history.replaceState(null, "", url);
            }}><BookmarkSimple aria-hidden="true" />Resume here next time</Button>}
          </div>
        </li>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">No topics were found in this document.</p>}
      </section> : <section className="space-y-8">
        <div><h2 className="text-xl font-medium">Key concepts</h2><p className="mt-1 text-sm text-muted-foreground">The ideas and definitions to revisit while you study.</p>
          <dl className="mt-5 grid gap-4 md:grid-cols-2">{guide.data!.keyConcepts.map((concept, index) => <div key={index} className="rounded-xl border border-border bg-surface p-5">
            <dt className="mb-3 text-lg font-medium text-primary">{concept.term}</dt><dd><StudyText text={concept.definition} /></dd>
          </div>)}</dl>
        </div>
        {guide.data!.keyTerms.length > 0 && <div><h3 className="text-lg font-medium">Glossary</h3><p className="mt-1 text-sm text-muted-foreground">Terms from your document. Definitions appear in the key concepts where available.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{guide.data!.keyTerms.map((term, index) => {
            const definition = guide.data!.keyConcepts.find((concept) => concept.term.toLowerCase() === term.toLowerCase())?.definition;
            return <div key={index} className="rounded-lg border border-border bg-surface p-4"><dt className="font-medium text-primary">{term}</dt><dd className="mt-2 text-sm leading-6 text-muted-foreground">{definition ?? "Mentioned in your notes. Use Ask to explore this term."}</dd></div>;
          })}</dl>
        </div>}
        <p className="text-xs text-muted-foreground">AI-generated from your document. Check important details against the original.</p>
      </section>}
    </TabsContent>
  </Tabs>;
}
