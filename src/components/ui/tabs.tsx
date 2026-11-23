"use client";

import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  value,
  onValueChange,
  children,
  label,
}: {
  tabs: readonly { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onValueChange: (value: T) => void;
  children: ReactNode;
  label: string;
}) {
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            ref={(element) => { buttons.current[index] = element; }}
            type="button"
            role="tab"
            id={`${id}-${tab.value}-tab`}
            aria-controls={value === tab.value ? `${id}-${tab.value}-panel` : undefined}
            aria-selected={value === tab.value}
            tabIndex={value === tab.value ? 0 : -1}
            onClick={() => onValueChange(tab.value)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              buttons.current[next]?.focus();
              onValueChange(tabs[next].value);
            }}
            className={cn(
              "flex min-h-11 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4",
              value === tab.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-${value}-panel`}
        aria-labelledby={`${id}-${value}-tab`}
        tabIndex={0}
        className="pt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </div>
    </div>
  );
}
