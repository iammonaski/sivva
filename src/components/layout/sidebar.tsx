"use client";

import { useState, useSyncExternalStore } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  SquaresFour,
  FolderSimple,
  FileText,
  Gear,
  SignOut,
  User,
  CaretUpDown,
  SidebarSimple,
  Sun,
  Moon,
  Desktop,
} from "@phosphor-icons/react";
import { useSession, signOut } from "@/lib/auth/auth-client";
import { trpc } from "@/lib/trpc/client";
import { LogoMark } from "@/components/shared/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  useSidebarPreference,
  setSidebarCollapsed,
} from "./sidebar-preference";
import { cn } from "@/lib/utils";

const WORKSPACE_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: SquaresFour },
  { label: "Library", href: "/library", icon: FolderSimple },
];
const THEME_ITEMS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Desktop },
];
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary/40",
          pending ? "animate-pulse motion-reduce:animate-none" : "opacity-0",
        )}
      />
      {pending && (
        <span role="status" className="sr-only">
          Opening page
        </span>
      )}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const collapsed = useSidebarPreference();
  const recentDocuments = trpc.dashboard.getStats.useQuery(undefined, {
    enabled: Boolean(session?.user) && !collapsed,
  });
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
    const active =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            className={cn(
              "relative flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-2 text-[13px] leading-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:h-[38px] md:min-h-0 md:flex-none md:justify-start md:gap-0 md:px-0",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "font-normal text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <span className="flex shrink-0 items-center justify-center md:w-[38px]">
              <Icon size={18} weight="regular" aria-hidden="true" />
            </span>
            <span className={cn("truncate md:pr-3", collapsed && "md:hidden")}>
              {item.label}
            </span>
            <NavigationFeedback />
          </Link>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent
            side="right"
            sideOffset={10}
            className="hidden md:block"
          >
            {item.label}
          </TooltipContent>
        )}
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        aria-label="Workspace sidebar"
        data-collapsed={collapsed}
        className={cn(
          "relative z-10 flex shrink-0 flex-col rounded-xl border border-border bg-surface/90 transition-[width] duration-200 ease-out motion-reduce:transition-none md:h-full dark:bg-surface/80",
          collapsed ? "md:w-16" : "md:w-56",
        )}
      >
        <div className="relative flex h-[72px] shrink-0 items-center px-3">
          <Link
            href="/dashboard"
            aria-label="Sivva dashboard"
            className={cn(
              "flex min-w-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "md:invisible",
            )}
          >
            <span className="flex w-[38px] shrink-0 items-center justify-center">
              <LogoMark className="size-7 text-primary" />
            </span>
            <span
              className={cn(
                "ml-1 text-base font-medium tracking-tight",
                collapsed && "md:hidden",
              )}
            >
              Sivva
            </span>
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "absolute top-5 hidden size-8 text-muted-foreground md:inline-flex md:size-8",
                  collapsed ? "left-[15px]" : "right-3",
                )}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                aria-controls="workspace-navigation"
                onClick={() => setSidebarCollapsed(!collapsed)}
              >
                <SidebarSimple className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div aria-hidden="true" className="mx-3 mb-3 border-t border-border/70" />

        <div className="min-h-0 px-3 pb-3 md:flex-1 md:overflow-y-auto">
          <nav
            id="workspace-navigation"
            aria-label="Main navigation"
            className="flex gap-1 md:block md:space-y-1"
          >
            {WORKSPACE_ITEMS.map(navigationItem)}
          </nav>

          {!collapsed && (isPending || session?.user) && (
            <section
              aria-labelledby="recent-documents-heading"
              className="mt-7 hidden md:block"
            >
              <h2
                id="recent-documents-heading"
                className="mb-2 px-2 text-xs font-normal text-muted-foreground"
              >
                Recent documents
              </h2>
              {isPending || recentDocuments.isLoading ? (
                <div aria-busy="true" aria-label="Fetching recent documents" className="space-y-1">
                  {["w-28", "w-24", "w-32"].map((width) => (
                    <div key={width} className="flex h-8 items-center gap-2 px-2">
                      <Skeleton className="size-4 shrink-0" />
                      <Skeleton className={cn("h-3", width)} />
                    </div>
                  ))}
                </div>
              ) : recentDocuments.error ? (
                <div className="px-2">
                  <p role="status" className="text-xs leading-5 text-muted-foreground">
                    Recent documents couldn’t load.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 md:px-0"
                    onClick={() => void recentDocuments.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : recentDocuments.data?.recentMaterials.length ? (
                <ul className="space-y-1">
                  {recentDocuments.data.recentMaterials.slice(0, 4).map((material) => {
                    const href = `/library/${material.id}`;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={material.id}>
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          title={material.title}
                          className={cn(
                            "relative flex h-8 min-w-0 items-center rounded-md text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "bg-accent font-medium text-accent-foreground"
                              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                          )}
                        >
                          <span className="flex w-[38px] shrink-0 justify-center">
                            <FileText size={16} weight="regular" aria-hidden="true" />
                          </span>
                          <span className="truncate pr-2">{material.title}</span>
                          <NavigationFeedback />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-2 text-xs leading-5 text-muted-foreground">
                  Your documents will appear here.
                </p>
              )}
            </section>
          )}
        </div>

        <div className="shrink-0 px-3 pb-3">
          <div className="border-t border-border pt-3">
            {isPending ? (
              <div
                aria-busy="true"
                aria-label="Fetching your profile"
                className="flex h-11 items-center md:h-[38px]"
              >
                <span className="flex w-[38px] shrink-0 justify-center">
                  <Skeleton className="size-7 rounded-md" />
                </span>
                <Skeleton
                  className={cn("ml-2 h-3 w-24", collapsed && "md:hidden")}
                />
              </div>
            ) : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    aria-label="Open profile menu"
                    className="h-11 w-full justify-start gap-0 px-0 text-left font-normal md:h-[38px] md:px-0"
                  >
                    <span className="flex w-[38px] shrink-0 justify-center">
                      <span className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-medium text-foreground">
                        {session.user.name?.charAt(0).toUpperCase() || (
                          <User className="size-4" aria-hidden="true" />
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "ml-1 min-w-0 flex-1 truncate text-[13px]",
                        collapsed && "md:hidden",
                      )}
                    >
                      {session.user.name || "Student"}
                    </span>
                    <CaretUpDown
                      className={cn(
                        "mr-2 ml-2 size-3.5 text-muted-foreground",
                        collapsed && "md:hidden",
                      )}
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  sideOffset={10}
                  className="w-56"
                >
                  <DropdownMenuLabel className="px-3 py-2">
                    <span className="block truncate text-[13px] font-medium">
                      {session.user.name || "Student"}
                    </span>
                    <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                      {session.user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-11 px-3 text-[13px] md:min-h-8">
                    <Link href="/settings" aria-current={pathname === "/settings" || pathname.startsWith("/settings/") ? "page" : undefined}>
                      <Gear className="size-4" aria-hidden="true" />Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      disabled={!mounted || !theme}
                      className="min-h-11 px-3 text-[13px] md:min-h-8"
                    >
                      <Sun
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Appearance
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent
                        sideOffset={2}
                        className="w-28 min-w-0"
                      >
                        <DropdownMenuRadioGroup
                          value={mounted ? theme : undefined}
                          onValueChange={(value) => {
                            if (
                              THEME_ITEMS.some((item) => item.value === value)
                            )
                              setTheme(value);
                          }}
                        >
                          {THEME_ITEMS.map(({ value, label, icon: Icon }) => (
                            <DropdownMenuRadioItem
                              key={value}
                              value={value}
                              className="min-h-11 gap-1 pl-5 text-xs [&>span]:left-1 [&>span]:size-2 md:min-h-0 md:py-1"
                            >
                              <Icon
                                className="size-3.5 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={signingOut}
                    className="min-h-11 px-3 text-[13px] md:min-h-8"
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleSignOut();
                    }}
                  >
                    <SignOut className="size-4" aria-hidden="true" />
                    Sign out
                  </DropdownMenuItem>
                  {signingOut && (
                    <div
                      role="status"
                      aria-label="Signing out"
                      className="px-3 py-2"
                    >
                      <Skeleton className="h-1 w-full" />
                    </div>
                  )}
                  {signOutError && (
                    <p
                      role="alert"
                      className="px-3 py-2 text-xs text-destructive"
                    >
                      Could not sign out. Try again.
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost" className="w-full text-[13px]">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
