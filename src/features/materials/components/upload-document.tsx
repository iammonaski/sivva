"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { MAX_FILE_BYTES, uploadErrorSchema, uploadResponseSchema } from "../schemas/material";

export function UploadDocument({ className, dropzone = false }: { className?: string; dropzone?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className={className}>
      <input ref={input} type="file" className="hidden" aria-label="Choose a document"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={uploading} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }} />
      {dropzone ? <div
        onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault(); setDragging(false);
          if (uploading) return;
          if (event.dataTransfer.files.length !== 1) { setError("Drop one PDF or DOCX at a time."); return; }
          void upload(event.dataTransfer.files[0]);
        }}
        className={cn("flex flex-col items-center gap-5 rounded-xl border border-dashed bg-surface px-5 py-8 text-center transition-colors", dragging ? "border-primary bg-accent" : "border-input")}
      >
        <span className="flex size-11 items-center justify-center rounded-md bg-muted text-foreground"><UploadSimple size={23} weight="regular" aria-hidden="true" /></span>
        <div><h3 className="text-sm font-medium">Drop your document here</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">PDF or DOCX, up to 4 MB.</p></div>
        <Button disabled={uploading} onClick={() => input.current?.click()}>Choose document</Button>
      </div> : <Button className="gap-2" disabled={uploading} onClick={() => input.current?.click()}>
        <UploadSimple size={16} weight="bold" aria-hidden="true" />Upload document
      </Button>}
      {uploading && <div role="status" aria-label="Document upload in progress" className="mt-3 space-y-2">
        <Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-3/4" />
      </div>}
      {error && <p role="alert" className="mt-2 max-w-sm text-sm text-destructive">{error}</p>}
    </div>
  );
}
