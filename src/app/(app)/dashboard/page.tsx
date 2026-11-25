"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText, FolderSimple, ListBullets, ChatCircle, LockSimple } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadDocument } from "@/features/materials/components/upload-document";
import { MaterialStatus } from "@/features/materials/components/material-status";
import { DashboardNavbar } from "@/features/dashboard/components/dashboard-navbar";

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
  const userName = session?.user?.name?.trim().split(/\s+/)[0];
  const welcomePending = sessionPending || stats.isLoading;
  const isNewLibrary = stats.data?.totalMaterials === 0;
  const greeting = `${isNewLibrary ? "Welcome to Sivva" : "Welcome back"}${userName ? `, ${userName}` : ""}`;
  const [search, setSearch] = useState("");
  const searchTerm = search.trim().toLowerCase();
  const matchingMaterials = stats.data?.recentMaterials.filter((material) => `${material.title} ${material.fileName}`.toLowerCase().includes(searchTerm)) ?? [];
  const latestMaterial = matchingMaterials[0];
  const otherMaterials = matchingMaterials.slice(1);

  return (
    <div className="space-y-8 rounded-xl border border-border bg-surface/90 p-4 sm:p-6 md:-mx-6 md:-my-8 md:min-h-[calc(100dvh-1rem)] md:pt-0 lg:-mx-10 lg:p-8 lg:pt-0 dark:bg-surface/80">
      <DashboardNavbar search={search} onSearchChange={setSearch} />

      <div className="space-y-8">
        <section aria-label="Welcome" className="space-y-6">
          <div aria-busy={welcomePending} className="relative flex min-h-36 flex-col justify-center overflow-hidden rounded-xl bg-accent px-5 py-6 sm:px-7 md:min-h-40 dark:bg-muted/40">
            <div className="relative min-w-0">
              <h1 className="line-clamp-2 break-words text-2xl font-medium leading-8 tracking-tight sm:text-3xl sm:leading-10">
                {welcomePending ? <Skeleton className="h-10 w-72 max-w-full" /> : greeting}
              </h1>
              {welcomePending ? (
                <div className="mt-3 max-w-xl space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : (
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {isNewLibrary
                    ? "Upload lecture notes to get an overview, explore topics, and ask questions."
                    : "Open a document to review its topics, study guide, or ask a question."}
                </p>
              )}
            </div>
          </div>

          {!stats.error && (
            <section aria-labelledby="library-summary-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-surface/40 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
              <h2 id="library-summary-heading" className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
                <FolderSimple size={16} weight="regular" aria-hidden="true" />
                Your library
              </h2>

              <dl aria-busy={stats.isLoading} className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-border">
                {[
                  { label: "Materials", value: stats.data?.totalMaterials ?? 0 },
                  { label: "Topics", value: stats.data?.totalTopics ?? 0 },
                  { label: "Study guides", value: stats.data?.totalStudyGuides ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 px-3 first:pl-0 last:pr-0 sm:first:pl-4">
                    <dt className="text-xs leading-5 text-muted-foreground">{item.label}</dt>
                    <dd className="break-words text-base font-medium leading-6">
                      {stats.isLoading ? <Skeleton className="h-5 w-6" /> : item.value.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </section>

        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="study-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id="study-heading" className="text-lg font-medium">
                  {searchTerm ? "Search results" : "Your study desk"}
                </h2>
                {!stats.error && !stats.isLoading && latestMaterial && (
                  <p className="text-xs text-muted-foreground">{searchTerm ? "Most recent match" : "Latest addition"}</p>
                )}
              </div>

              {stats.error ? (
                <Card role="alert" className="gap-4 p-5 sm:p-6">
                  <h3 className="text-lg font-medium">Your study desk couldn’t load</h3>
                  <p className="break-words text-sm leading-6 text-muted-foreground">{stats.error.message}</p>
                  <Button variant="outline" className="self-start" onClick={() => void stats.refetch()}>Retry dashboard</Button>
                </Card>
              ) : stats.isLoading ? (
                <Card aria-busy="true" aria-label="Fetching your study desk" className="gap-0 p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <Skeleton className="size-12 rounded-lg" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="mt-6 h-8 w-3/4" />
                  <Skeleton className="mt-3 h-4 w-1/2" />
                  <Skeleton className="mt-6 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                  <div className="mt-6 border-t border-border pt-5"><Skeleton className="h-11 w-44 md:h-9" /></div>
                </Card>
              ) : latestMaterial ? (
                <Card className="gap-0 overflow-hidden border-primary/15 bg-accent/40 py-0">
                  <CardContent className="p-5 sm:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex size-12 items-center justify-center rounded-lg border border-primary/10 bg-surface text-primary">
                        <FileText size={25} weight="regular" aria-hidden="true" />
                      </div>
                      <MaterialStatus status={latestMaterial.status} />
                    </div>

                    <h3 className="mt-5 line-clamp-2 break-words text-xl font-medium leading-8 tracking-tight sm:text-2xl" title={latestMaterial.title}>
                      {latestMaterial.title}
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                      <span className="rounded-sm border border-border bg-surface px-2 py-1">{latestMaterial.fileType.toUpperCase()}</span>
                      <span>Added {formatDate(latestMaterial.createdAt)}</span>
                    </div>
                    <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
                      {latestMaterial.status === "ready"
                        ? "Your overview, topics and study guide are ready to explore."
                        : latestMaterial.status === "error"
                          ? "Open this document to review the issue and try again."
                          : "Your document is being prepared. Open it to follow its progress."}
                    </p>

                    <div className="mt-6 border-t border-primary/10 pt-5">
                      <Button asChild className="w-full sm:w-auto">
                        <Link href={`/library/${latestMaterial.id}`}>
                          {latestMaterial.status === "ready" ? "Open study workspace" : "Open document"}
                          <ArrowRight size={18} aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : searchTerm ? (
                <Card className="gap-0 p-5 sm:p-7">
                  <FileText size={28} className="text-muted-foreground" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-medium">No recent materials match</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    This search covers your five most recent materials. Open your library to find older documents.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>
                    <Button variant="ghost" asChild><Link href="/library">View library</Link></Button>
                  </div>
                </Card>
              ) : (
                <Card className="gap-0 border-primary/15 bg-accent/40 p-5 sm:p-7">
                  <div className="flex size-12 items-center justify-center rounded-lg border border-primary/10 bg-surface text-primary">
                    <BookOpen size={25} weight="regular" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 max-w-md text-xl font-medium leading-8 tracking-tight sm:text-2xl">
                    Start with your lecture notes
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    Add your first PDF or DOCX to get an overview, explore its topics and ask questions grounded in your notes.
                  </p>
                  <p className="mt-6 border-t border-primary/10 pt-5 text-sm leading-6 text-muted-foreground">
                    Choose a document in the upload panel to get started.
                  </p>
                </Card>
              )}
            </section>

            {!stats.error && (stats.isLoading || otherMaterials.length > 0) && (
              <section aria-labelledby="recent-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 id="recent-heading" className="text-lg font-medium">{searchTerm ? "More matches" : "Recent materials"}</h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/library">View library <ArrowRight size={16} aria-hidden="true" /></Link>
                  </Button>
                </div>
                <Card className="gap-0 overflow-hidden py-0">
                  {stats.isLoading ? (
                    <div aria-busy="true" aria-label="Fetching recent materials" className="divide-y divide-border">
                      {[0, 1, 2].map((row) => (
                        <div key={row} className="flex items-center gap-3 p-4 sm:px-5">
                          <Skeleton className="size-10 shrink-0 rounded-md" />
                          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                          <Skeleton className="hidden h-6 w-16 sm:block" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {otherMaterials.map((material) => (
                        <li key={material.id}>
                          <Link href={`/library/${material.id}`} className="group flex min-w-0 items-center gap-3 p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-5">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
                              <FileText size={20} weight="regular" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-medium" title={material.title}>{material.title}</h3>
                              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>{material.fileType.toUpperCase()}</span>
                                <span>{formatDate(material.createdAt)}</span>
                              </p>
                              <div className="mt-2 sm:hidden"><MaterialStatus status={material.status} /></div>
                            </div>
                            <span className="hidden shrink-0 sm:block"><MaterialStatus status={material.status} /></span>
                            <ArrowRight size={17} aria-hidden="true" className="shrink-0 text-muted-foreground group-hover:text-foreground" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            )}
          </div>

          <div className="min-w-0 space-y-7">
            <section aria-labelledby="upload-heading">
              <h2 id="upload-heading" className="mb-4 text-lg font-medium">Add lecture notes</h2>
              <UploadDocument dropzone />
              <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
                <LockSimple size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>Your original document stays private. Only you can access your materials.</span>
              </p>
            </section>

            <section aria-labelledby="tools-heading" className="border-t border-border pt-6">
              <h2 id="tools-heading" className="text-sm font-medium">From notes to understanding</h2>
              <div className="mt-5 space-y-5">
                {STUDY_TOOLS.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="flex items-start gap-3">
                    <Icon size={19} weight="regular" aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <h3 className="text-xs font-medium leading-5">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
