"use client";

import * as React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ListBullets,
  ChatCircleText,
  UploadSimple,
  ArrowRight,
  Clock,
} from "@phosphor-icons/react";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: stats, isLoading } = trpc.dashboard.getStats.useQuery();

  const userName = session?.user?.name?.split(" ")[0] || "Student";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {userName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick up where you left off or upload new course materials to study.
          </p>
        </div>
        <Link href="/library">
          <Button className="gap-2">
            <UploadSimple size={16} weight="bold" />
            Upload Document
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Materials
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                  <FileText size={18} weight="bold" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">
                {stats?.totalMaterials ?? 0}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Extracted Topics
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                  <ListBullets size={18} weight="bold" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">
                {stats?.totalTopics ?? 0}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Study Guides
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                  <ChatCircleText size={18} weight="bold" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">
                {stats?.totalMaterials ?? 0}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Materials */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Recent Materials
          </h2>
          <Link
            href="/library"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight size={12} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : stats?.recentMaterials && stats.recentMaterials.length > 0 ? (
          <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
            {stats.recentMaterials.map((material) => (
              <Link
                key={material.id}
                href={`/library/${material.id}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground uppercase text-xs font-semibold">
                    {material.fileType}
                  </div>
                  <div className="truncate">
                    <p className="truncate text-sm font-medium text-foreground">
                      {material.title}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(material.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
                  <ArrowRight size={14} className="text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
              <FileText size={24} />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              No lecture materials yet
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Upload your course lecture notes or slides to generate topic
              breakdowns, study guides, and grounded Q&A.
            </p>
            <Link href="/library" className="mt-4">
              <Button size="sm">Upload your first document</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
