"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/shared/search-input";
import { UploadDocument } from "@/features/materials/components/upload-document";
import { DashboardNavbar } from "@/features/dashboard/components/dashboard-navbar";
import { LectureNotebook } from "@/features/dashboard/components/lecture-notebook";
import { FeaturedLecture, FirstLectureGuide, LectureList } from "@/features/dashboard/components/study-desk";

function isPreparing(item: { status: string } | null) {
  return !!item && ["pending", "processing", "extracted", "analyzing"].includes(item.status);
}
function ListSkeleton() {
  return <div role="status" aria-label="Fetching lectures" className="space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>;
}

export default function DashboardPage() {
  const desk = trpc.dashboard.getStats.useQuery(undefined, {
    refetchInterval: ({ state: { data } }) => data && (isPreparing(data.featured) || data.recentMaterials.some(isPreparing)) ? 3000 : false,
  });
  const [search, setSearch] = useState("");
  const term = search.trim();
  const [query, setQuery] = useState("");
  useEffect(() => { const id = setTimeout(() => setQuery(term), 180); return () => clearTimeout(id); }, [term]);
  const results = trpc.dashboard.search.useQuery({ query }, { enabled: !!term && query === term,
    refetchInterval: ({ state: { data } }) => data?.items.some(isPreparing) ? 3000 : false });
  const data = desk.data;
  const previousStatuses = useRef(new Map<string, string>());
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!data) return;
    const visible = new Map([...data.recentMaterials, ...(data.featured ? [data.featured] : []), ...(query && query === term ? results.data?.items ?? [] : [])].map((item) => [item.id, item]));
    const ready: string[] = [];
    const failed: string[] = [];
    for (const item of visible.values()) {
      const previous = previousStatuses.current.get(item.id);
      if (!previous || previous === item.status) continue;
      if (item.status === "ready") ready.push(item.title);
      if (item.status === "error") failed.push(item.title);
    }
    previousStatuses.current = new Map([...visible].map(([id, item]) => [id, item.status]));
    const messages = [
      failed.length === 1 ? `Open ${failed[0]} for details. Its notes couldn’t be prepared.` : failed.length > 1 && `${failed.length} lectures on this desk failed. Open a failed lecture for details.`,
      ready.length === 1 ? `${ready[0]} is ready to study.` : ready.length > 1 && `${ready.length} lectures on this desk are now ready to study.`,
    ].filter(Boolean);
    if (messages.length) setAnnouncement(messages.join(" "));
  }, [data, results.data, query, term]);
  const searching = !!term;
  const waiting = searching && (query !== term || results.isLoading);
  const items = searching ? results.data?.items ?? [] : data?.recentMaterials ?? [];
  function clearSearch() { setSearch(""); document.getElementById("desk-search")?.focus(); }

  return <div className="relative mx-auto max-w-5xl space-y-3 sm:space-y-8 [&>[data-study-updates]]:m-0">
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-study-updates>{announcement}</div>
    <DashboardNavbar hasLectures={!!data?.featured} />
    {!data ? desk.isError ? <section role="alert" className="space-y-3 rounded-xl border border-border p-5">
      <h2 className="text-lg font-medium">Your study desk couldn’t load</h2><p className="text-sm text-muted-foreground">Try again or open your library to find your notes.</p>
      <div className="flex flex-wrap gap-2"><Button onClick={() => void desk.refetch()}>Try again</Button><Button variant="outline" asChild><Link href="/library">Open library</Link></Button></div>
    </section> : <div role="status" aria-label="Fetching study desk" className="space-y-6"><Skeleton className="h-56 rounded-xl" /><ListSkeleton /></div>
    : !data.featured ? <><UploadDocument label="Upload lecture notes" illustration={<LectureNotebook />} /><FirstLectureGuide /></>
    : <>
      <FeaturedLecture lecture={data.featured} />
      <section aria-labelledby="desk-library" className="space-y-2 sm:space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="desk-library" className="text-xl font-medium">{searching ? "Search results" : <><span className="sm:hidden">Recent notes</span><span className="hidden sm:inline">Lecture library</span></>}</h2>
          <Button asChild variant="ghost" size="sm"><Link href="/library" aria-label={`View all ${data.totalMaterials} lectures in your library`}>View all {data.totalMaterials} <ArrowRight aria-hidden="true" /></Link></Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" onKeyDown={(e) => { if (e.key === "Escape" && searching) clearSearch(); }}>
          <SearchInput id="desk-search" label="Search all lecture notes" placeholder="Search all lecture notes" value={search} maxLength={255} onValueChange={setSearch} className="w-full sm:max-w-xs" />
          <div role="status" aria-live="polite" aria-atomic="true" className={`${searching ? "" : "max-[399px]:sr-only"} text-xs leading-5 text-muted-foreground`}>
            {searching ? waiting || results.isError ? "" : `${items.length}${results.data?.hasMore ? "+" : ""} ${items.length === 1 ? "match" : "matches"}` : `Latest uploads · ${data.totalMaterials} ${data.totalMaterials === 1 ? "lecture" : "lectures"} in library`}
          </div>
        </div>
        {waiting ? <ListSkeleton /> : searching && results.isError ? <div role="alert" className="space-y-2 py-4"><p>Search couldn’t load.</p><Button variant="outline" onClick={() => void results.refetch()}>Retry search</Button></div>
        : !items.length ? <div className="border-t border-border py-6"><h3 className="font-medium">No matching lectures</h3><p className="mt-1 text-sm text-muted-foreground">Try another title or filename.</p><Button variant="outline" className="mt-4" onClick={clearSearch}>Clear search</Button></div>
        : <><LectureList items={items} />{searching && results.data?.hasMore && <Button asChild variant="outline"><Link href={`/library?q=${encodeURIComponent(term)}`}>View all matches</Link></Button>}</>}
      </section>
    </>}
  </div>;
}
