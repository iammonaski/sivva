"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LockSimple, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { MAX_FILE_BYTES, uploadErrorSchema, uploadResponseSchema } from "../schemas/material";

export function UploadDocument({ className, label = "Upload document", variant = "default", showFileHint = false, illustration }: {
  className?: string; label?: string; variant?: "default" | "outline"; showFileHint?: boolean; illustration?: ReactNode;
}) {
  const hint = useId();
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (busy.current) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES || file.size === 0 || !/\.(pdf|docx)$/i.test(file.name)) {
      setError("Choose a non-empty PDF or DOCX, 4 MB or smaller.");
      if (input.current) input.current.value = "";
      return;
    }
    busy.current = true;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/materials/upload", { method: "POST", body });
      const data: unknown = await response.json();
      if (!response.ok) {
        const parsed = uploadErrorSchema.safeParse(data);
        throw new Error(parsed.success ? parsed.data.error : "The upload failed. Please try again.");
      }
      const result = uploadResponseSchema.parse(data);
      void utils.material.list.invalidate();
      void utils.dashboard.invalidate();
      router.push(`/library/${result.materialId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed. Please try again.");
    } finally {
      busy.current = false;
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  const trigger = <Button type="button" variant={variant} disabled={uploading} aria-describedby={hint}
    title={illustration ? undefined : "PDF or DOCX, up to 4 MB"} onClick={() => input.current?.click()}><UploadSimple aria-hidden="true" />{uploading ? "Uploading notes…" : label}</Button>;
  const feedback = <>
    <span role="status" className="sr-only">{uploading ? "Uploading your lecture notes." : ""}</span>
    {uploading && <Skeleton className="mt-3 h-1.5 w-32 bg-primary/20" />}
    {error && <p role="alert" className="mt-2 max-w-sm break-words text-sm font-medium text-foreground">{error}</p>}
  </>;
  return <div className={cn(showFileHint && "text-right", className)}>
    <input ref={input} type="file" className="hidden" aria-label="Choose a document"
      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    {illustration ? <section aria-labelledby="first-lecture" onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault(); setDragging(false);
        if (uploading) return;
        if (event.dataTransfer.files.length !== 1) { setError("Drop one PDF or DOCX at a time."); return; }
        void upload(event.dataTransfer.files[0]);
      }} className={cn("relative isolate overflow-hidden rounded-xl border border-primary/20 bg-accent/70 p-5 sm:p-8 lg:p-10", dragging && "ring-2 ring-inset ring-primary")}>
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0 max-w-lg">
          <h2 id="first-lecture" className="text-2xl font-medium leading-tight tracking-tight sm:text-3xl">Start with your lecture notes</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-foreground/80 sm:text-base">Turn a lecture into a study guide, then ask questions with answers tied to your notes.</p>
          <div className="mt-6">{trigger}{feedback}</div>
          <p id={hint} className="mt-3 text-xs leading-5 text-foreground/75"><span className="hidden sm:inline">Or drop a file here. </span>PDF or DOCX, up to 4 MB.</p>
        </div>
        <div aria-hidden="true" className="hidden w-[28%] max-w-60 shrink-0 sm:block">{illustration}</div>
      </div>
    </section> : <>{trigger}<span id={hint} className={showFileHint ? "mt-1 block text-xs leading-4 text-muted-foreground" : "sr-only"}>PDF / DOCX · 4 MB max</span>{feedback}</>}
    {illustration && <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground"><LockSimple className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Only you can access your uploaded notes.</p>}
  </div>;
}
