"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchInput({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div role="search" className={cn("relative min-w-0", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <MagnifyingGlass
        size={17}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="border-transparent bg-muted/60 pl-9 text-base focus-visible:border-primary/60 focus-visible:ring-0 md:text-[13px] [@media(pointer:coarse)]:text-base"
      />
    </div>
  );
}
