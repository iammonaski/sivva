"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UploadDocument } from "@/features/materials/components/upload-document";
import { MaterialStatus } from "@/features/materials/components/material-status";
import { FileText } from "@phosphor-icons/react";

export default function DashboardPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const stats = trpc.dashboard.getStats.useQuery(undefined, {
    refetchInterval: (query) => query.state.data?.recentMaterials.some((material) => ["pending", "processing", "extracted", "analyzing"].includes(material.status)) ? 2000 : false,
  });
  const userName = session?.user?.name?.split(" ")[0] || "Student";

  return <div className="space-y-8">
    <header><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{sessionPending ? <Skeleton className="h-9 w-64" /> : `Welcome back, ${userName}`}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pick up a document or add new notes to study.</p>
    </header>
    <UploadDocument dropzone />
    {stats.error ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{stats.error.message}</p><Button variant="outline" onClick={() => void stats.refetch()}>Retry dashboard</Button></div> : <>
      {stats.isLoading ? <div aria-busy="true" aria-label="Fetching library totals" className="grid grid-cols-3 gap-4"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : <dl className="grid grid-cols-3 gap-4 border-b border-border pb-6">
        {[{ label: "Materials", value: stats.data?.totalMaterials }, { label: "Topics", value: stats.data?.totalTopics }, { label: "Study guides", value: stats.data?.totalStudyGuides }].map((item) => <div key={item.label}><dt className="text-sm text-muted-foreground">{item.label}</dt><dd className="mt-1 text-2xl font-semibold">{item.value}</dd></div>)}
      </dl>}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-medium">Recent materials</h2><Link href="/library" className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">View library</Link></div>
        {stats.isLoading ? <div aria-busy="true" aria-label="Fetching recent materials" className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          : stats.data?.recentMaterials.length ? <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">{stats.data.recentMaterials.map((material) => <li key={material.id}><Link href={`/library/${material.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <div className="flex min-w-0 items-center gap-3"><FileText size={24} className="shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><h3 className="break-words text-sm font-medium">{material.title}</h3><p className="mt-1 text-xs text-muted-foreground">{material.fileType.toUpperCase()} · {new Date(material.createdAt).toLocaleDateString()}</p></div></div>
            <MaterialStatus status={material.status} />
          </Link></li>)}</ul> : <div className="rounded-xl border border-border bg-surface p-6"><h3 className="font-medium">Your study library starts here</h3><p className="mt-2 text-sm text-muted-foreground">Upload your first document above to get an overview, topic outline, and grounded answers.</p></div>}
      </section>
    </>}
  </div>;
}
