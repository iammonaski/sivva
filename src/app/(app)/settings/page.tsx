"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { User, SignOut } from "@phosphor-icons/react";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal profile and account credentials.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          Profile Information
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your account details registered with Sivva
        </p>

        <div className="mt-6 space-y-4">
          {isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ) : session?.user ? (
            <>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary font-medium text-lg">
                  {session.user.name ? (
                    session.user.name.charAt(0).toUpperCase()
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 gap-2"
                  onClick={handleSignOut}
                >
                  <SignOut size={16} />
                  Sign out of account
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not currently signed in.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
