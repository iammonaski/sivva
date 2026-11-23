import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <path
        d="M12 21v-7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 12.5c0-3.6-2.9-6.5-6.5-6.5 0 3.6 2.9 6.5 6.5 6.5Z"
        fill="currentColor"
      />
      <path
        d="M12 12.5c0-3.6 2.9-6.5 6.5-6.5 0 3.6-2.9 6.5-6.5 6.5Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M12 9.5c1.7 0 3-1.6 3-3.5 0-1.9-1.3-3.5-3-3.5S9 4.1 9 6c0 1.9 1.3 3.5 3 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-7 w-7 text-primary" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Sivva
      </span>
    </span>
  );
}
