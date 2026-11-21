import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

export async function createTRPCContext() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  return {
    session,
    headers: reqHeaders,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
