import { appRouter } from "./routers/_app";
import { createTRPCContext } from "./context";
import { createCallerFactory } from "./init";

const createCaller = createCallerFactory(appRouter);

export async function createServerCaller() {
  const ctx = await createTRPCContext();
  return createCaller(ctx);
}
