"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BookBookmark,
  SquaresFour,
  FolderSimple,
  Gear,
  SignOut,
  User,
  CaretUpDown,
  SidebarSimple,
} from "@phosphor-icons/react";

const WORKSPACE_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: SquaresFour },
  { label: "Library", href: "/library", icon: FolderSimple },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const result = await signOut();
      if (result.error) throw new Error("Sign out failed");
      router.push("/login");
      router.refresh();
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  function navigationItem(item: (typeof WORKSPACE_ITEMS)[number]) {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Tooltip key={item.href}>
      <TooltipTrigger asChild>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className={cn(
          "group relative flex min-h-11 flex-1 items-center justify-center gap-3 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:flex-none md:justify-start",
          active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "md:justify-center md:px-0",
        )}
      >
        {active && <span aria-hidden="true" className="absolute inset-y-3 left-0 hidden w-0.5 rounded-full bg-primary md:block" />}
        <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden="true" className="shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
      </Link>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right" sideOffset={12} className="hidden md:block">{item.label}</TooltipContent>}
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
    <aside className={cn(
      "relative z-10 flex shrink-0 flex-col rounded-xl border border-border bg-surface md:h-full",
      collapsed ? "md:w-20" : "md:w-60",
    )}>
      <div className={cn("flex items-center gap-3 p-4 md:pb-8", collapsed && "md:flex-col md:gap-4 md:px-3")}>
        <Link href="/dashboard" aria-label="Sivva dashboard" className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookBookmark size={23} weight="regular" aria-hidden="true" />
          </span>
          <span className={cn("text-lg font-medium tracking-tight", collapsed && "md:hidden")}>Sivva</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn("ml-auto hidden size-8 text-muted-foreground md:inline-flex", collapsed && "md:ml-0")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <SidebarSimple size={18} aria-hidden="true" />
        </Button>
        <div className="ml-auto md:hidden"><ThemeToggle /></div>
      </div>

      <nav aria-label="Main navigation" className="flex gap-1 px-2 pb-2 md:block md:flex-1 md:space-y-1 md:px-3">
        <p className={cn("mb-3 hidden px-3 text-xs text-muted-foreground md:block", collapsed && "md:sr-only")}>Workspace</p>
        {WORKSPACE_ITEMS.map(navigationItem)}
        <div className="flex flex-1 md:hidden">{navigationItem({ label: "Settings", href: "/settings", icon: Gear })}</div>
      </nav>

      <div className={cn("border-t border-border p-3", collapsed && "md:px-3")}>
        <div className="mb-4 hidden md:block">
          <p className={cn("mb-2 px-3 text-xs text-muted-foreground", collapsed && "sr-only")}>Account</p>
          {navigationItem({ label: "Settings", href: "/settings", icon: Gear })}
          <div className={cn("mt-1 flex items-center justify-between pl-3", collapsed && "justify-center pl-0")}>
            <span className={cn("text-sm text-muted-foreground", collapsed && "hidden")}>Appearance</span>
            <ThemeToggle />
          </div>
        </div>
        {isPending ? (
          <div className="flex items-center gap-3" aria-busy="true" aria-label="Fetching your profile">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className={cn("flex-1 space-y-2", collapsed && "md:hidden")}><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-full" /></div>
          </div>
        ) : session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" aria-label="Open profile menu" className={cn("h-auto min-h-11 w-full justify-start gap-3 p-1 text-left md:h-auto md:min-h-11 md:p-1", collapsed && "md:justify-center")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium">
                  {session.user.name?.charAt(0).toUpperCase() || <User size={18} aria-hidden="true" />}
                </span>
                <span className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
                  <span className="block truncate text-sm font-medium">{session.user.name || "Student"}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">{session.user.email}</span>
                </span>
                <CaretUpDown size={16} className={cn("shrink-0 text-muted-foreground", collapsed && "md:hidden")} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
              <DropdownMenuItem asChild><Link href="/settings"><Gear size={18} aria-hidden="true" />Settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={signingOut} onSelect={(event) => { event.preventDefault(); void handleSignOut(); }}><SignOut size={18} aria-hidden="true" />Sign out</DropdownMenuItem>
              {signOutError && <p role="alert" className="px-3 py-2 text-xs text-destructive">Could not sign out. Try again.</p>}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : <Link href="/login" className="block rounded-md px-3 py-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">Sign in</Link>}
      </div>
    </aside>
    </TooltipProvider>
  );
}
