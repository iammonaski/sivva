import type { Metadata } from "next";
import Link from "next/link";
import { BookBookmark } from "@phosphor-icons/react/dist/ssr";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "Authentication — Sivva",
  description: "Sign in or create an account for Sivva AI Study Companion",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <header aria-label="Appearance" className="absolute right-4 top-4 sm:right-6">
        <ThemeToggle />
      </header>
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-primary transition-opacity hover:opacity-90"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
              <BookBookmark size={24} weight="bold" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              Sivva
            </span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Learn smarter. Study better.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
