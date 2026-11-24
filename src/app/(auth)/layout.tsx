import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoMark } from "@/components/shared/logo";
import { Card } from "@/components/ui/card";

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
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-2 sm:px-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to home
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-4">
        <div className="w-full max-w-[400px]">
          <Card className="block p-6">
            <Link
              href="/"
              aria-label="Sivva home"
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/10 bg-accent text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <LogoMark className="h-6 w-6" />
            </Link>
            {children}
          </Card>
          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            Sivva. Learn smarter. Study better.
          </p>
        </div>
      </main>
    </div>
  );
}
