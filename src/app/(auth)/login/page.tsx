"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GoogleLogo,
  Envelope,
  Lock,
  CircleNotch,
} from "@phosphor-icons/react";

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
      const res = await signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Invalid email or password");
        setIsLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Failed to initialize Google Sign In. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your study companion
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2.5"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isLoading}
      >
        {isGoogleLoading ? (
          <CircleNotch className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleLogo className="h-4 w-4" weight="bold" />
        )}
        Continue with Google
      </Button>

      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-border" />
        <span className="bg-surface px-3 text-xs uppercase tracking-wider text-muted-foreground">
          or with email
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-xs font-medium text-foreground"
          >
            Email address
          </label>
          <div className="relative">
            <Envelope
              className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
              weight="regular"
            />
            <Input
              id="email"
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              required
              disabled={isLoading || isGoogleLoading}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-xs font-medium text-foreground"
          >
            Password
          </label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
              weight="regular"
            />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
              required
              disabled={isLoading || isGoogleLoading}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || isGoogleLoading}
        >
          {isLoading && <CircleNotch className="h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
