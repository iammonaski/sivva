import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-background text-foreground">
      <main className="flex max-w-2xl flex-col items-center gap-6">
        <span className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold tracking-wide text-primary">
          AI Study Companion
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Sivva
        </h1>
        <p className="text-lg text-muted-foreground">
          Learn smarter. Study better. Upload lecture notes, understand key
          concepts, and practice with an AI tutor grounded in your materials.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Button size="lg">Get Started</Button>
          <Button variant="outline" size="lg">
            Documentation
          </Button>
        </div>
      </main>
    </div>
  );
}
