import { readdirSync, readFileSync } from "node:fs";

/**
 * In-process Postgres (PGlite) with every migration applied, shaped like `@/db/client`.
 * Use from a test via: vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());
 */
export async function createTestDbModule() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { sql } = await import("drizzle-orm");
  const schema = await import("@/db/schema");

  const pg = new PGlite();
  const migrations = readdirSync("db/migrations")
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  for (const file of migrations) await pg.exec(readFileSync(`db/migrations/${file}`, "utf8"));

  const db = drizzle(pg, { schema, casing: "snake_case" });
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  return {
    schema,
    getDb: () => db,
    isDatabaseConfigured: () => true,
    withTenant: <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
        return fn(tx);
      }),
  };
}
