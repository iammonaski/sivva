"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileText, ListBullets, ChatCircle } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadDocument } from "@/features/materials/components/upload-document";
import { MaterialStatus } from "@/features/materials/components/material-status";

const STUDY_TOOLS = [
  { icon: BookOpen, title: "See the big picture", description: "Start with an overview and key concepts from your notes." },
  { icon: ListBullets, title: "Explore each topic", description: "Follow the topic outline back to the relevant section." },
  { icon: ChatCircle, title: "Ask a follow-up", description: "Get answers grounded in your document, with source references." },
];

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const stats = trpc.dashboard.getStats.useQuery(undefined, {
    refetchInterval: (query) => query.state.data?.recentMaterials.some((material) => ["pending", "processing", "extracted", "analyzing"].includes(material.status)) ? 2000 : false,
  });
  const userName = session?.user?.name?.split(" ")[0] || "Student";
  const latestMaterial = stats.data?.recentMaterials[0];
  const otherMaterials = stats.data?.recentMaterials.slice(1) ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-6">
        <p className="text-sm text-muted-foreground">Dashboard</p>
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl sm:leading-10">
            {sessionPending ? <Skeleton className="h-10 w-64 max-w-full" /> : `Welcome back, ${userName}`}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your notes, a little clearer. Pick up a document and keep learning.</p>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="study-heading" className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="study-heading" className="text-lg font-medium">Your study desk</h2>
            <Link href="/library" className="rounded-md py-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">View library</Link>
          </div>

          {stats.error ? (
            <Card role="alert" className="gap-4 p-6">
              <h3 className="font-medium">Your study desk couldn’t load</h3>
              <p className="break-words text-sm text-muted-foreground">{stats.error.message}</p>
              <Button variant="outline" className="self-start" onClick={() => void stats.refetch()}>Retry dashboard</Button>
            </Card>
          ) : stats.isLoading ? (
            <div aria-busy="true" aria-label="Fetching your study desk" className="rounded-xl border border-border bg-surface p-6 sm:p-8">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-6 h-7 w-3/4" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-8 h-11 w-40" />
              <div className="mt-8 space-y-6 border-t border-border pt-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            </div>
          ) : latestMaterial ? (
            <Card className="gap-0 overflow-hidden py-0">
              <CardContent className="p-5 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Latest addition</p>
                  <MaterialStatus status={latestMaterial.status} />
                </div>
                <div className="mt-6 flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground"><FileText size={25} weight="regular" aria-hidden="true" /></div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 break-words text-xl font-medium leading-8 tracking-tight sm:text-2xl" title={latestMaterial.title}>{latestMaterial.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground">{latestMaterial.fileType.toUpperCase()} <span aria-hidden="true" className="mx-2">/</span> Added {formatDate(latestMaterial.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                    {latestMaterial.status === "ready" ? "Your overview, topics and study guide are ready to explore." : latestMaterial.status === "error" ? "Open this document to review the issue and try again." : "Your document is being prepared. Open it to follow its progress."}
                  </p>
                  <Button asChild>
                    <Link href={`/library/${latestMaterial.id}`}>
                      {latestMaterial.status === "ready" ? "Open study workspace" : "Open document"}<ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </CardContent>

              {otherMaterials.length > 0 && (
                <div className="border-t border-border">
                  <h3 className="px-5 pt-5 text-xs text-muted-foreground sm:px-8">Recent materials</h3>
                  <ul className="mt-2 divide-y divide-border">
                    {otherMaterials.map((material) => (
                      <li key={material.id}>
                        <Link href={`/library/${material.id}`} className="group flex items-center gap-3 px-5 py-5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-8">
                          <FileText size={21} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-medium" title={material.title}>{material.title}</h4>
                            <p className="mt-1.5 text-xs text-muted-foreground">{material.fileType.toUpperCase()} <span aria-hidden="true" className="mx-1">/</span> {formatDate(material.createdAt)}</p>
                            <div className="mt-2 sm:hidden"><MaterialStatus status={material.status} /></div>
                          </div>
                          <span className="hidden shrink-0 sm:block"><MaterialStatus status={material.status} /></span>
                          <ArrowRight size={17} aria-hidden="true" className="shrink-0 text-muted-foreground group-hover:text-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ) : (
            <Card className="block p-6 sm:p-8">
              <BookOpen size={32} className="text-primary" weight="regular" aria-hidden="true" />
              <h3 className="mt-6 text-xl font-medium leading-8 tracking-tight sm:text-2xl">Make room for a clearer understanding</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Add your first lecture document. We’ll turn it into an overview, a topic outline and a place to ask questions.</p>
              <div className="mt-8 space-y-6 border-t border-border pt-6">
                {STUDY_TOOLS.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="flex items-start gap-4">
                    <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div><h4 className="text-sm font-medium">{title}</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {!stats.error && (
            <div className="mt-5">
              <p className="text-xs text-muted-foreground">Across your library</p>
              {stats.isLoading ? (
                <div aria-busy="true" aria-label="Fetching library totals" className="mt-3 flex gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-28" /></div>
              ) : (
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {[{ label: "materials", value: stats.data?.totalMaterials ?? 0 }, { label: "topics", value: stats.data?.totalTopics ?? 0 }, { label: "study guides", value: stats.data?.totalStudyGuides ?? 0 }].map((item) => (
                    <div key={item.label} className="flex items-baseline gap-1.5"><dd className="font-medium tabular-nums">{item.value.toLocaleString()}</dd><dt className="text-muted-foreground">{item.label}</dt></div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="upload-heading" className="min-w-0 xl:pt-2">
          <h2 id="upload-heading" className="mb-4 text-lg font-medium">Add lecture notes</h2>
          <UploadDocument dropzone />
          <p className="mt-4 px-1 text-xs leading-5 text-muted-foreground">Your original document stays private. Study guides and tutor answers are grounded in your notes.</p>
        </section>
      </div>
    </div>
  );
}
