"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleLogo, CircleNotch } from "@phosphor-icons/react";
import { signIn } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/password-input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await signIn.email({ email, password });

      if (res.error) {
        setError(res.error.message || "Invalid email or password");
        setIsLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Unable to sign in. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const res = await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
      if (res.error) {
        setError(res.error.message || "Unable to sign in with Google. Please try again.");
        setIsGoogleLoading(false);
      }
    } catch {
      setError("Unable to sign in with Google. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold leading-7 tracking-tight text-foreground">
          Welcome back to Sivva
        </h1>
        <p className="text-sm leading-5 text-muted-foreground">
          Sign in to pick up where you left off.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2.5 shadow-none sm:h-10"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isLoading}
        aria-busy={isGoogleLoading}
      >
        {isGoogleLoading ? (
          <CircleNotch aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <GoogleLogo aria-hidden="true" weight="bold" />
        )}
        Continue with Google
      </Button>

      <div className="flex items-center gap-4">
        <div aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-xs text-muted-foreground">or sign in with email</span>
        <div aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" aria-busy={isLoading}>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 text-base shadow-none sm:h-10 sm:text-sm"
            required
            disabled={isLoading || isGoogleLoading}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 text-base shadow-none sm:h-10 sm:text-sm"
            required
            disabled={isLoading || isGoogleLoading}
          />
        </div>

        <Button type="submit" className="h-11 w-full shadow-none sm:h-10" disabled={isLoading || isGoogleLoading}>
          {isLoading && <CircleNotch aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm leading-5 text-muted-foreground">
        New to Sivva?{" "}
        <Link href="/register" className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Create an account
        </Link>
      </p>
    </div>
  );
}
