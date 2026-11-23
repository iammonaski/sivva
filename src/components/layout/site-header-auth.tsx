"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth/auth-client";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function SiteHeaderAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-28" />;
  }

  if (session?.user) {
    return (
      <Link
        href="/dashboard"
        className={buttonVariants({ size: "default", className: "px-4" })}
      >
        Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className={buttonVariants({ size: "default", className: "px-4" })}
      >
        Get started
      </Link>
    </>
  );
}
