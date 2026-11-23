"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  BookBookmark,
  SquaresFour,
  FolderSimple,
  Gear,
  SignOut,
  User,
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: SquaresFour,
  },
  {
    label: "Library",
    href: "/library",
    icon: FolderSimple,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Gear,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex shrink-0 flex-col border-b border-border bg-surface md:h-dvh md:w-64 md:border-r md:border-b-0">
      {/* Brand Header */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 md:h-16 md:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
          <BookBookmark size={20} weight="bold" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-foreground tracking-tight">Sivva</span>
          <span className="text-[11px] text-muted-foreground leading-none">
            Study Companion
          </span>
        </div>
        <ThemeToggle className="ml-auto" />
      </div>

      {/* Navigation Links */}
      <nav aria-label="Main navigation" className="flex gap-1 p-2 md:block md:flex-1 md:space-y-1 md:p-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:justify-start md:gap-3 md:px-3.5 ${
                isActive
                  ? "bg-accent text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={18} weight={isActive ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Section Footer */}
      <div className="hidden border-t border-border p-4 md:block">
        {isPending ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : session?.user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary font-medium text-xs">
                {session.user.name ? (
                  session.user.name.charAt(0).toUpperCase()
                ) : (
                  <User size={14} />
                )}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-medium text-foreground">
                  {session.user.name || "Student"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <SignOut size={16} />
            </Button>
          </div>
        ) : (
          <Link href="/login" className="w-full">
            <Button variant="outline" size="sm" className="w-full">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </aside>
  );
}
