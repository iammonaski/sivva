"use client";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentAnalysis({ materialId }: { materialId: string }) {
  const guide = trpc.analysis.getStudyGuide.useQuery({ id: materialId });
  const topics = trpc.analysis.getTopics.useQuery({ id: materialId });
  if (guide.isLoading || topics.isLoading) return <section aria-busy="true" className="space-y-4 rounded-xl border border-border bg-surface p-6">
    <Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
  </section>;
  if (guide.error || topics.error) return <p role="alert" className="text-destructive">{guide.error?.message ?? topics.error?.message}</p>;
  if (!guide.data) return <p role="alert" className="text-destructive">No study guide was found. Please refresh or upload the document again.</p>;
  return <div className="space-y-6">
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-medium text-primary">Overview</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{guide.data.overview}</p>
    </section>
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-medium text-primary">Topics</h2>
      <ol className="mt-4 space-y-4">{topics.data?.map((topic) => <li key={topic.id}>
        <h3 className="font-medium">{topic.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{topic.summary}</p>
      </li>)}</ol>
    </section>
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-medium text-primary">Study guide</h2>
      <dl className="mt-4 space-y-4">{guide.data.keyConcepts.map((concept, index) => <div key={index}>
        <dt className="font-medium">{concept.term}</dt><dd className="mt-1 text-sm leading-6 text-muted-foreground">{concept.definition}</dd>
      </div>)}</dl>
      {guide.data.keyTerms.length > 0 && <div className="mt-6">
        <h3 className="font-medium">Key terms</h3>
        <ul className="mt-2 flex flex-wrap gap-2">{guide.data.keyTerms.map((term, index) => <li key={index} className="rounded-md bg-accent px-3 py-1 text-sm text-primary">{term}</li>)}</ul>
      </div>}
      <p className="mt-6 text-xs text-muted-foreground">AI-generated from your document. Check important details against the original.</p>
    </section>
  </div>;
}
