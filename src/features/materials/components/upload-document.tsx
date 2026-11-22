"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { MAX_FILE_BYTES, uploadErrorSchema, uploadResponseSchema } from "../schemas/material";

export function UploadDocument({ className }: { className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES || file.size === 0) {
      setError("Choose a non-empty PDF or DOCX, 4 MB or smaller.");
      return;
    }
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
      <Button className="gap-2" disabled={uploading} onClick={() => input.current?.click()}>
        <UploadSimple size={16} weight="bold" />
        {uploading ? "Uploading document…" : "Upload Document"}
      </Button>
      {uploading && <div role="status" aria-label="Document upload in progress" className="mt-3 space-y-2">
        <Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-3/4" />
      </div>}
      {error && <p role="alert" className="mt-2 max-w-sm text-sm text-destructive">{error}</p>}
    </div>
  );
}
