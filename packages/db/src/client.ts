import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

// PgBouncer-safe pool: keep max connections low.
// PgBouncer runs in transaction mode, so prepared statements must be disabled.
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,             // PgBouncer-safe: keep this low
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // PgBouncer transaction mode disallows prepared statements
      // drizzle-orm/node-postgres does not use prepared stmts by default
    });

    pool.on("error", (err) => {
      console.error("[db] Unexpected pool error", err);
    });
  }
  return pool;
}

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Returns a Drizzle ORM instance backed by a shared pg Pool.
 * Safe to call multiple times — returns the same singleton pool.
 *
 * Usage:
 *   const db = getDb();
 *   const deals = await db.select().from(schema.deals);
 */
export function getDb(): Db {
  return drizzle(getPool(), { schema });
}

/** Graceful shutdown — call this on SIGTERM/SIGINT in long-lived processes. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
