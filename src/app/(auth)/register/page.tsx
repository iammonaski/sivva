"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp, signIn } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GoogleLogo,
  Envelope,
  Lock,
  User,
  CircleNotch,
} from "@phosphor-icons/react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await signUp.email({
        name,
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to create account");
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
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground">
          Join Sivva to organize your lecture notes and study smarter
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
            htmlFor="name"
            className="text-xs font-medium text-foreground"
          >
            Full name
          </label>
          <div className="relative">
            <User
              className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
              weight="regular"
            />
            <Input
              id="name"
              type="text"
              placeholder="Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-9"
              required
              disabled={isLoading || isGoogleLoading}
            />
          </div>
        </div>

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
              placeholder="At least 8 characters"
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
          Create account
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
