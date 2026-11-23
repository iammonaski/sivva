import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background md:h-dvh md:flex-row md:overflow-hidden">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <React.Suspense fallback={<Skeleton className="h-28 w-full shrink-0 rounded-none md:h-dvh md:w-64" />}>
        <Sidebar />
      </React.Suspense>
      <main id="main-content" className="min-w-0 flex-1 md:overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
