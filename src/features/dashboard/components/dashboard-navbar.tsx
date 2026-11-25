"use client";

import { Bell, MagnifyingGlass, Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function DashboardNavbar({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:h-[72px]">
      <div role="search" className="relative min-w-0 md:w-[90%]">
        <label htmlFor="dashboard-search" className="sr-only">
          Search recent materials
        </label>
        <MagnifyingGlass
          size={17}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="dashboard-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search recent materials"
          enterKeyHint="search"
          className="border-transparent bg-muted/60 pl-9 text-base focus-visible:border-primary/60 focus-visible:ring-0 md:text-[13px] [@media(pointer:coarse)]:text-base"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle light and dark mode"
          className="text-muted-foreground"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Moon className="size-[18px] dark:hidden" weight="regular" aria-hidden="true" />
          <Sun className="hidden size-[18px] dark:block" weight="regular" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="text-muted-foreground"
            >
              <Bell
                className="size-[18px]"
                weight="regular"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 max-w-[calc(100vw-32px)] rounded-xl p-2"
          >
            <DropdownMenuLabel className="text-[13px]">
              Notifications
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
              Notifications aren’t available yet. You can check document progress
              on your study desk.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
