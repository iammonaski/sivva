"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Keep the first client render identical to SSR, even with a saved theme.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      role="switch"
      aria-label="Dark mode"
      aria-checked={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      disabled={!mounted || !resolvedTheme}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("h-11 w-11 shrink-0 text-muted-foreground", className)}
    >
      <Moon aria-hidden="true" weight="bold" className="dark:hidden" />
      <Sun aria-hidden="true" weight="bold" className="hidden dark:block" />
    </Button>
  );
}
