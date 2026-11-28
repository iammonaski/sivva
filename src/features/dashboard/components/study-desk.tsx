import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowRight, BookBookmark, BookOpen, BookmarkSimple, CaretRight, ChatCircleText, FileText, ListBullets } from "@phosphor-icons/react";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { Button } from "@/components/ui/button";
import { MaterialStatus } from "@/features/materials/components/material-status";
import { cn } from "@/lib/utils";
import { LectureNotebook } from "./lecture-notebook";

type Desk = inferRouterOutputs<AppRouter>["dashboard"]["getStats"];
const destinations: Record<string, string> = { topics: "Topic outline", guide: "Study guide", ask: "Ask your notes", resources: "Resources" };
const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

export function FeaturedLecture({ lecture }: { lecture: NonNullable<Desk["featured"]> }) {
  const ready = lecture.status === "ready";
  const failed = lecture.status === "error";
  const opened = lecture.lastOpenedAt !== null;
  const href = `/library/${encodeURIComponent(lecture.id)}`;
  const destination = lecture.resumeTopic ?? destinations[lecture.lastStudyTab ?? ""] ?? "Overview";
  const resume = new URLSearchParams();
  if (ready && opened && lecture.lastStudyTab && lecture.lastStudyTab !== "overview") {
    resume.set("tab", lecture.lastStudyTab);
    if (lecture.lastStudyTab === "topics" && lecture.lastTopicId) resume.set("topic", lecture.lastTopicId);
  }
  return <section aria-labelledby="desk-lecture" className={cn("grid overflow-hidden rounded-xl border", ready ? "border-primary/20 bg-accent/70 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : failed ? "border-destructive/35 bg-destructive/5" : "border-border bg-muted/50")}>
    <div className="min-w-0 px-4 py-3 sm:p-8 lg:p-9">
      {ready ? <p className="flex items-center gap-2 text-sm font-medium text-accent-foreground"><BookmarkSimple weight="fill" aria-hidden="true" className="size-4" />{opened ? "Last studied" : "Ready to study"}</p> : <MaterialStatus status={lecture.status} />}
      <h2 id="desk-lecture" className="mt-1.5 line-clamp-2 sm:mt-4 break-words text-xl min-[400px]:text-2xl font-medium leading-tight tracking-tight sm:text-3xl" title={lecture.title}>{lecture.title}</h2>
      <div className="mt-1.5 flex flex-wrap sm:mt-3 items-center gap-x-3 gap-y-1 text-xs leading-5 text-foreground/75">
        {opened ? <span className="line-clamp-2 break-words" title={destination}>Resume at: <strong className="font-medium text-foreground">{destination}</strong></span> : <span>{lecture.fileType.toUpperCase()}</span>}<span className={opened ? "hidden sm:inline" : undefined}>{opened ? "Opened" : "Added"} <time dateTime={new Date(lecture.lastOpenedAt ?? lecture.createdAt).toISOString()}>{date.format(new Date(lecture.lastOpenedAt ?? lecture.createdAt))}</time></span>
      </div>
      {!ready && <p className="mt-3 max-w-sm text-sm leading-6 text-foreground/80">{failed ? "These notes couldn’t be prepared. Open the document for details." : "Your notes are being prepared. You can check their progress now."}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-6"><Button asChild><Link href={resume.size ? `${href}?${resume}` : href}>{ready ? opened ? "Continue studying" : "Start studying" : failed ? "Review issue" : "Check progress"}<ArrowRight aria-hidden="true" /></Link></Button>
        {lecture.outline.length > 0 && <Link href={`${href}?tab=topics`} className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden">Outline</Link>}
      </div>
    </div>
    {lecture.outline.length > 0 ? <div className="hidden min-w-0 border-t border-primary/15 bg-surface/55 sm:block sm:px-8 sm:py-4 md:my-6 md:flex md:flex-col md:justify-center md:border-t-0 md:border-l md:bg-transparent md:py-0">
      <h3 className="flex items-center gap-2 text-sm font-medium"><ListBullets aria-hidden="true" className="size-4 text-primary" />In these notes</h3>
      <div className="flex items-center gap-3 sm:block">
        <ul className="min-w-0 flex-1 divide-y divide-primary/10 sm:mt-2">{lecture.outline.map((topic) => <li key={topic.id}>
          <Link href={`${href}?tab=topics&topic=${encodeURIComponent(topic.id)}`} className="group flex min-h-11 items-center gap-2 rounded-sm py-2 text-sm leading-5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
            <span className="line-clamp-2 min-w-0 flex-1 break-words" title={topic.title}>{topic.title}</span><CaretRight aria-hidden="true" className="hidden size-3.5 shrink-0 text-primary sm:block" />
          </Link></li>)}</ul>
      </div>
    </div> : ready && <div className="hidden w-44 justify-self-center self-center md:block lg:w-48"><LectureNotebook /></div>}
  </section>;
}

export function LectureList({ items }: { items: Desk["recentMaterials"] }) {
  return <ul className="divide-y divide-border border-y border-border">{items.map((lecture) => {
    const added = new Date(lecture.createdAt);
    return <li key={lecture.id}>
      <Link href={`/library/${encodeURIComponent(lecture.id)}`} className="group flex min-h-14 min-w-0 items-center gap-3 rounded-sm px-1 py-2 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-16 sm:gap-4 sm:px-2 sm:py-3">
        <span className="hidden size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground min-[400px]:flex"><FileText aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p title={lecture.title} className="line-clamp-2 break-words text-sm font-medium leading-5 underline-offset-4 group-hover:text-primary group-hover:underline group-focus-visible:underline">{lecture.title}</p>
            <span className="hidden sm:inline-flex"><MaterialStatus status={lecture.status} /></span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-4 text-muted-foreground sm:mt-1">
            <span>{lecture.fileType.toUpperCase()}</span><span aria-hidden="true">·</span>
            <time dateTime={added.toISOString()} title={date.format(added)} className="whitespace-nowrap"><span className="sr-only sm:not-sr-only">Added </span><span className="sm:hidden" aria-hidden="true">{shortDate.format(added)}</span><span className="sr-only sm:not-sr-only">{date.format(added)}</span></time>
            <span className="ml-1 inline-flex sm:hidden"><MaterialStatus status={lecture.status} /></span>
          </div>
        </div>
      </Link>
    </li>;
  })}</ul>;
}

export function FirstLectureGuide() {
  return <section aria-labelledby="desk-guide"><h2 id="desk-guide" className="text-lg font-medium">After you upload</h2>
    <ul className="mt-3 grid divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:pt-5">
      {[
        { icon: BookOpen, title: "Read the overview", description: "See the main ideas from your lecture in one place." },
        { icon: BookBookmark, title: "Explore a topic", description: "Follow a concept into the outline and related readings." },
        { icon: ChatCircleText, title: "Ask your notes", description: "Ask a follow-up and check the cited page or section." },
      ].map(({ icon: Icon, title, description }) => <li key={title} className="flex gap-3 py-4 sm:block sm:px-5 sm:py-0 sm:first:pl-0 sm:last:pr-0">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h3 className="text-sm font-medium sm:mt-3">{title}</h3><p className="mt-1 max-w-64 text-sm leading-6 text-muted-foreground">{description}</p></div>
      </li>)}
    </ul></section>;
}
