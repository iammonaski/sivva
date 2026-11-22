import type { Context } from "@/server/trpc/context";

export function createCallerContext(userId: string | null): Context {
  const now = new Date();
  return {
    headers: new Headers(),
    session: userId === null ? null : {
      session: { id: "test-session", token: "test-token", userId, expiresAt: new Date(now.getTime() + 60_000), createdAt: now, updatedAt: now, ipAddress: null, userAgent: null },
      user: { id: userId, name: "Test user", email: `${userId}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now, image: null },
    },
  };
}
