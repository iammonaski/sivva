import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col gap-2 bg-background p-2 lg:h-dvh lg:flex-row lg:gap-0 lg:overflow-hidden">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <React.Suspense fallback={<Skeleton className="h-[58px] w-full shrink-0 rounded-xl lg:h-full lg:w-56" />}>
        <Sidebar />
      </React.Suspense>
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none lg:overflow-y-auto">
        <div className="mx-auto max-w-6xl pb-4 lg:px-12 lg:py-8">
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-6 lg:-my-8 lg:min-h-[calc(100dvh-1rem)] lg:-mx-10 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
