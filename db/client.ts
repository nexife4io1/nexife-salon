import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The single typed DB client for the core salon domain.
 *
 * Boundary rule: only `server/<domain>/repository.ts` (and db/seed) may import
 * this file — enforced by eslint.config.mjs.
 *
 * ORM choice: Drizzle (over Prisma) — SQL-first, no codegen/engine binary,
 * first-class Postgres RLS + `set_config` support, and light enough for a
 * single Next.js process.
 */

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything a repository can run queries against. */
export type Executor = Database | Transaction;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Reuse the pool across dev hot reloads instead of leaking connections.
const globalForDb = globalThis as unknown as { __nexifeDb?: Database };

export function getDb(): Database {
  if (globalForDb.__nexifeDb) return globalForDb.__nexifeDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();

  const client = postgres(url, {
    max: 10,
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
  });
  const db = drizzle(client, { schema, casing: "snake_case" });
  if (process.env.NODE_ENV !== "production") globalForDb.__nexifeDb = db;
  return db;
}

/**
 * Run `fn` in a transaction scoped to one tenant. Sets `app.tenant_id` for the
 * duration of the transaction so Row-Level Security policies (see the `rls`
 * migration) can enforce isolation in the database, not just in app code.
 *
 * Repositories should still filter by tenant_id explicitly — RLS is the
 * safety net, not a replacement.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

export { schema };
