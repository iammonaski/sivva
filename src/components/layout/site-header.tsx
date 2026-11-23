import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { SiteHeaderAuth } from "@/components/layout/site-header-auth";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          aria-label="Sivva home"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <SiteHeaderAuth />
        </nav>
      </div>
    </header>
  );
}
