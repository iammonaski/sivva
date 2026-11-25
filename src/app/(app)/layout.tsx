import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-background p-2 md:h-dvh md:flex-row md:gap-0 md:overflow-hidden">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <React.Suspense fallback={<Skeleton className="h-40 w-full shrink-0 rounded-xl md:h-full md:w-56" />}>
        <Sidebar />
      </React.Suspense>
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none md:overflow-y-auto">
        <div className="mx-auto max-w-6xl py-4 md:px-8 md:py-8 lg:px-12">{children}</div>
      </main>
    </div>
  );
}
