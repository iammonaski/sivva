"use client";

import { useState } from "react";
import { BookOpen, ChatCircleText, FileText, ListBullets } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { StudyText } from "@/components/shared/study-text";
import { TutorChat } from "@/features/tutor/components/tutor-chat";

type StudyTab = "overview" | "topics" | "guide" | "ask";
const tabs = [
  { value: "overview", label: "Overview", icon: <FileText size={18} aria-hidden="true" /> },
  { value: "topics", label: "Topics", icon: <ListBullets size={18} aria-hidden="true" /> },
  { value: "guide", label: "Study Guide", icon: <BookOpen size={18} aria-hidden="true" /> },
  { value: "ask", label: "Ask", icon: <ChatCircleText size={18} aria-hidden="true" /> },
] as const;

export function DocumentAnalysis({ materialId }: { materialId: string }) {
  const [tab, setTab] = useState<StudyTab>("overview");
  const guide = trpc.analysis.getStudyGuide.useQuery({ id: materialId });
  const topics = trpc.analysis.getTopics.useQuery({ id: materialId });
  const loading = tab === "topics" ? topics.isLoading : guide.isLoading;
  const error = tab === "topics" ? topics.error : guide.error;

  return <Tabs tabs={tabs} value={tab} onValueChange={setTab} label="Study workspace">
    {tab === "ask" ? <TutorChat materialId={materialId} /> : loading ? <section aria-busy="true" aria-label="Fetching study content" className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
    </section> : error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error.message}</p><Button variant="outline" onClick={() => void (tab === "topics" ? topics.refetch() : guide.refetch())}>Retry</Button></div>
      : tab !== "topics" && !guide.data ? <p role="alert" className="text-destructive">No study guide was found. Refresh or upload the document again.</p>
      : tab === "overview" ? <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="mb-5 text-xl font-medium">Document overview</h2>
        <StudyText text={guide.data!.overview} />
        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">Generated from your document. Check important details against the original.</p>
      </section> : tab === "topics" ? <section>
        <h2 className="text-xl font-medium">Topic outline</h2><p className="mt-1 text-sm text-muted-foreground">Follow the topics in the order they appear in your notes.</p>
        {topics.data?.length ? <ol className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface">{topics.data.map((topic, index) => <li key={topic.id} className="flex gap-4 p-5 sm:p-6">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-medium text-primary">{index + 1}</span>
          <div className="min-w-0"><h3 className="mb-2 text-lg font-medium">{topic.title}</h3><StudyText text={topic.summary} /></div>
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
  </Tabs>;
}
