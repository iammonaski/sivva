"use client";

import * as React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  FileText,
  UploadSimple,
  Clock,
  ArrowRight,
  FolderSimple,
} from "@phosphor-icons/react";

export default function LibraryPage() {
  const { data: materials, isLoading } = trpc.material.list.useQuery();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Course Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your uploaded documents, lecture notes, and study workspaces.
          </p>
        </div>
        <Button className="gap-2">
          <UploadSimple size={16} weight="bold" />
          Upload Document
        </Button>
      </div>

      {/* Materials List */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : materials && materials.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <Link
              key={material.id}
              href={`/library/${material.id}`}
              className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-7 items-center rounded-md bg-muted px-2 text-[11px] font-semibold uppercase text-foreground">
                    {material.fileType}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      material.status === "ready"
                        ? "bg-accent text-primary"
                        : material.status === "processing"
                        ? "bg-amber-100 text-amber-800"
                        : material.status === "error"
                        ? "bg-red-100 text-red-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {material.status}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-foreground line-clamp-1">
                  {material.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {material.fileName}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(material.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 font-medium text-primary">
                  Open Study Workspace
                  <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
            <FolderSimple size={28} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            No materials uploaded yet
          </h3>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
            Upload PDF or DOCX lecture materials to extract concepts, create
            study guides, and interact with an AI tutor.
          </p>
          <Button className="mt-5 gap-2">
            <UploadSimple size={16} weight="bold" />
            Upload Document
          </Button>
        </div>
      )}
    </div>
  );
}
