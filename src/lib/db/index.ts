import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const { Pool } = pg;

const globalForDb = globalThis as unknown as {
  pool: pg.Pool | undefined;
};

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
