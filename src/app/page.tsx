import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  "Grounded in your own notes",
  "Page-level citations",
  "PDF & DOCX support",
];

export default function Home() {
  return (
    <div className="flex min-h-[100svh] flex-col">
      <SiteHeader />

      <main className="relative flex flex-1 items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(110% 65% at 50% -12%, rgba(167, 201, 87, 0.16) 0%, rgba(232, 245, 233, 0.6) 32%, rgba(250, 250, 248, 0) 68%)",
          }}
        />

        <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-20 text-center sm:pb-32 sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium tracking-wide text-primary shadow-sm motion-safe:animate-[fade-rise_0.5s_ease-out_both]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />
            AI Study Companion
          </span>

          <h1 className="mt-8 text-balance text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-7xl motion-safe:animate-[fade-rise_0.6s_ease-out_0.06s_both]">
            Learn smarter.
            <br />
            <span className="text-primary">Study better.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg motion-safe:animate-[fade-rise_0.6s_ease-out_0.12s_both]">
            Upload a lecture PDF or set of notes and get a clear study guide,
            organised topics, and a tutor that answers from your own material.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row motion-safe:animate-[fade-rise_0.6s_ease-out_0.18s_both]">
            <Link
              href="/register"
              className={buttonVariants({
                size: "lg",
                className: "h-11 w-full px-6 text-[15px] sm:w-auto",
              })}
            >
              Get started
              <ArrowRight weight="bold" />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "h-11 w-full px-6 text-[15px] sm:w-auto",
              })}
            >
              Sign in
            </Link>
          </div>

          <ul className="mt-14 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground sm:flex-row sm:gap-6 motion-safe:animate-[fade-rise_0.6s_ease-out_0.24s_both]">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item}
                className={cn(
                  "flex items-center gap-2",
                  index > 0 && "sm:border-l sm:border-border sm:pl-6"
                )}
              >
                <Check
                  weight="bold"
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-primary"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
