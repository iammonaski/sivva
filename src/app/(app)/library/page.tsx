"use client";

import { useState } from "react";
import Link from "next/link";
import { DownloadSimple, FolderSimple, ListBullets, SquaresFour } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UploadDocument } from "@/features/materials/components/upload-document";
import { MaterialStatus } from "@/features/materials/components/material-status";

export default function LibraryPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const query = trpc.material.list.useQuery(undefined, {
    refetchInterval: (result) => result.state.data?.some((material) => ["pending", "processing", "extracted", "analyzing"].includes(material.status)) ? 2000 : false,
  });
  const materials = query.data?.filter((material) => `${material.title} ${material.fileName}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Course library</h1><p className="mt-2 text-sm text-muted-foreground">Your notes, documents, and study workspaces.</p></div><UploadDocument /></header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-full sm:max-w-sm"><label htmlFor="library-search" className="sr-only">Search materials</label><Input id="library-search" type="search" placeholder="Search your materials" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="flex gap-1" role="group" aria-label="Library layout"><Button variant={view === "grid" ? "accent" : "ghost"} size="icon" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><SquaresFour aria-hidden="true" /></Button><Button variant={view === "list" ? "accent" : "ghost"} size="icon" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><ListBullets aria-hidden="true" /></Button></div>
    </div>
    {query.error ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()}>Retry library</Button></div> : query.isLoading ? <div aria-busy="true" aria-label="Fetching materials" className={view === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}><Skeleton className={view === "grid" ? "h-52 rounded-xl" : "h-28 rounded-xl"} /><Skeleton className={view === "grid" ? "h-52 rounded-xl" : "h-28 rounded-xl"} /><Skeleton className={view === "grid" ? "h-52 rounded-xl" : "h-28 rounded-xl"} /></div>
      : materials?.length ? <ul className={view === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>{materials.map((material) => <li key={material.id} className={`rounded-xl border border-border bg-surface p-5 ${view === "list" ? "flex flex-wrap items-center justify-between gap-4" : "flex flex-col"}`}>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge>{material.fileType.toUpperCase()}</Badge><MaterialStatus status={material.status} /></div>
          <h2 className="mt-3 text-lg font-medium"><Link href={`/library/${material.id}`} className="break-words text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{material.title}</Link></h2>
          <p className="mt-1 break-words text-xs text-muted-foreground">{material.fileName}</p><p className="mt-2 text-xs text-muted-foreground">{(material.fileSize / 1024 / 1024).toFixed(2)} MB · {new Date(material.createdAt).toLocaleDateString()}</p>
        </div>
        <div className={`flex flex-wrap items-center gap-3 ${view === "grid" ? "mt-5 border-t border-border pt-4" : ""}`}>
          <Link href={`/library/${material.id}`} className="py-2 text-sm font-medium text-primary outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">Open workspace</Link>
          <a href={`/api/materials/${encodeURIComponent(material.id)}/file`} aria-label={`Download original: ${material.title}`} className="ml-auto rounded-md border border-border p-2 text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><DownloadSimple size={18} aria-hidden="true" /></a>
        </div>
      </li>)}</ul> : query.data?.length ? <div className="rounded-xl border border-border bg-surface p-8 text-center"><h2 className="font-medium">No materials match your search</h2><Button variant="link" onClick={() => setSearch("")}>Clear search</Button></div>
        : <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-12 text-center"><FolderSimple size={32} className="mx-auto text-primary" aria-hidden="true" /><h2 className="mt-4 text-lg font-medium">No materials yet</h2><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Upload PDF or DOCX lecture notes to create a study guide and ask questions grounded in your document.</p><UploadDocument className="mt-5" /></div>}
  </div>;
}
