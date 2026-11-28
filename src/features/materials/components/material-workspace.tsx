"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, DownloadSimple, Trash } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentAnalysis } from "@/features/analysis/components/document-analysis";
import { UploadDocument } from "./upload-document";
import { studyTabSchema } from "../schemas/material";
import { MaterialStatus } from "./material-status";
import { Badge } from "@/components/ui/badge";

export function MaterialWorkspace({ materialId }: { materialId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [startedAfterProcessing, setStartedAfterProcessing] = useState(false);
  const material = trpc.material.getById.useQuery({ id: materialId });
  const params = useSearchParams();
  const tab = studyTabSchema.catch("overview").parse(params.get("tab"));
  const requestedTopic = params.get("topic");
  const topicId = tab === "topics" && requestedTopic && requestedTopic.length <= 200 ? requestedTopic : null;
  const lastRecorded = useRef<string | null>(null);
  const [confirmedTopic, setConfirmedTopic] = useState<string | null | undefined>(undefined);
  const save = trpc.material.markOpened.useMutation({
    retry: 1,
    scope: { id: "record-study-position" },
    onSuccess: (stored) => { setConfirmedTopic(stored.topicId); void utils.dashboard.getStats.invalidate(); },
  });
  const { mutate: markOpened } = save;
  const status = trpc.material.getStatus.useQuery(
    { id: materialId },
    {
      refetchInterval: (query) =>
        ["pending", "processing", "extracted", "analyzing"].includes(
          query.state.data?.status ?? "processing",
        )
          ? 2000
          : false,
    },
  );
  const currentStatus = status.data?.status ?? material.data?.status;
  const [enteredReady, setEnteredReady] = useState<boolean | null>(null);
  const initialStatus = material.data?.status;
  useEffect(() => {
    if (enteredReady === null && initialStatus) setEnteredReady(initialStatus === "ready");
  }, [enteredReady, initialStatus]);
  const openedId = currentStatus === "ready" ? material.data?.id : undefined;
  useEffect(() => {
    if (!openedId || (!enteredReady && !startedAfterProcessing)) return;
    const position = JSON.stringify([openedId, tab, topicId]);
    if (lastRecorded.current === position) return;
    lastRecorded.current = position;
    markOpened({ id: openedId, tab, topicId });
  }, [openedId, markOpened, tab, topicId, enteredReady, startedAfterProcessing]);
  const deletion = trpc.material.delete.useMutation({
    onSuccess: () => {
      void utils.material.list.invalidate();
      void utils.dashboard.invalidate();
      router.push("/library");
    },
  });
  if (material.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  if (material.error || !material.data)
    return (
      <div role="alert" className="space-y-4">
        <p className="text-destructive">
          {material.error?.message ?? "Material not found."}
        </p>
        <Link href="/library" className="text-primary underline">
          Return to library
        </Link>
      </div>
    );
  const processing = ["pending", "processing", "extracted", "analyzing"].includes(
    currentStatus ?? "",
  );
  const error = status.data?.errorMessage ?? material.data.errorMessage;

  const currentSave = save.variables?.id === materialId && save.variables.tab === tab && save.variables.topicId === topicId;
  const retryPosition = () => markOpened({ id: materialId, tab, topicId });
  const isHandoff = enteredReady === false && currentStatus === "ready" && !startedAfterProcessing;
  return (
    <div className="space-y-4 sm:space-y-6">
      <span className="sr-only" role="status" aria-atomic="true">{isHandoff ? "Your lecture is ready to study." : ""}</span>
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm text-primary"
      >
        <ArrowLeft size={16} />
        Library
      </Link>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-medium text-foreground sm:text-3xl">
            {material.data.title}
          </h1>
          <p className="mt-1 line-clamp-2 break-all text-sm text-muted-foreground" title={material.data.fileName}>{material.data.fileName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge>{material.data.fileType.toUpperCase()}</Badge>
            <MaterialStatus status={currentStatus ?? material.data.status} />
            <span className="text-xs text-muted-foreground">{(material.data.fileSize / 1024 / 1024).toFixed(2)} MB · Uploaded {new Date(material.data.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/materials/${encodeURIComponent(materialId)}/file`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border sm:min-h-9 border-border px-3 py-2 text-sm text-primary"
          >
            <DownloadSimple size={16} />
            Original
          </a>
          <Button
            variant="outline"
            disabled={deletion.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Delete this document and all of its study data? This cannot be undone.",
                )
              )
                deletion.mutate({ id: materialId });
            }}
          >
            <Trash size={16} />
            <span className="ml-2">Delete</span>
          </Button>
        </div>
      </div>
      {currentSave && save.isError && (!topicId || tab !== "topics") && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 p-3 text-sm">
        Your study position couldn’t be saved.<Button size="sm" variant="outline" onClick={retryPosition}>Retry save</Button>
      </div>}
      {(deletion.error || status.error) && (
        <p role="alert" className="text-sm text-destructive">
          {deletion.error?.message ?? status.error?.message}
        </p>
      )}
      {processing ? (
        <section
          className="space-y-4 rounded-xl border border-border bg-surface p-6"
          aria-live="polite"
          aria-busy="true"
        >
          <h2 className="text-lg font-medium">Preparing your document</h2>
          <p className="text-sm text-muted-foreground">
            {["extracted", "analyzing"].includes(currentStatus ?? "")
              ? "Generating your overview, topics, and study guide."
              : "Extracting readable text and preserving source sections."}
          </p>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </section>
      ) : currentStatus === "error" ? (
        <section
          role="alert"
          className="rounded-xl border border-destructive/30 bg-surface p-6"
        >
          <h2 className="font-semibold text-destructive">
            Document processing failed
          </h2>
          <p className="mt-2 text-sm">
            {error ?? "Try another copy of the lecture notes."}
          </p>
          <UploadDocument className="mt-4" label="Upload a replacement" variant="outline" />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">The new copy opens in its own workspace. This document stays in your library.</p>
        </section>
      ) : currentStatus === "ready" ? (
        isHandoff ? <section className="space-y-3 rounded-xl border border-primary/20 bg-accent/60 p-6">
          <h2 className="text-xl font-medium">Your lecture is ready</h2>
          <p className="text-sm text-foreground/80">Open the overview, explore topics, or ask a question about your notes.</p>
          <Button onClick={() => setStartedAfterProcessing(true)}>Start studying</Button>
        </section> : <DocumentAnalysis key={materialId} materialId={materialId} savedTopic={confirmedTopic === undefined ? material.data.lastTopicId : confirmedTopic} savingTopic={currentSave && save.isPending ? topicId : null} failedTopic={currentSave && save.isError ? topicId : null} onRetryPosition={retryPosition} />
      ) : null}
    </div>
  );
}
