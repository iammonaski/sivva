"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, DownloadSimple, Trash } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentAnalysis } from "@/features/analysis/components/document-analysis";
import { MaterialStatus } from "./material-status";
import { Badge } from "@/components/ui/badge";

export function MaterialWorkspace({ materialId }: { materialId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const material = trpc.material.getById.useQuery({ id: materialId });
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
  const currentStatus = status.data?.status ?? material.data.status;
  const processing = ["pending", "processing", "extracted", "analyzing"].includes(
    currentStatus,
  );
  const error = status.data?.errorMessage ?? material.data.errorMessage;

  return (
    <div className="space-y-6">
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm text-primary"
      >
        <ArrowLeft size={16} />
        Library
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">
            {material.data.title}
          </h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">{material.data.fileName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge>{material.data.fileType.toUpperCase()}</Badge>
            <MaterialStatus status={currentStatus} />
            <span className="text-xs text-muted-foreground">{(material.data.fileSize / 1024 / 1024).toFixed(2)} MB · Uploaded {new Date(material.data.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/materials/${encodeURIComponent(materialId)}/file`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-primary"
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
            {["extracted", "analyzing"].includes(currentStatus)
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
            {error ?? "Please delete the document and upload again."}
          </p>
        </section>
      ) : currentStatus === "ready" ? (
        <DocumentAnalysis key={materialId} materialId={materialId} />
      ) : null}
    </div>
  );
}
