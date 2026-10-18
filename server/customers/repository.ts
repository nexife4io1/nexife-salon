import "server-only";
import { and, asc, count, desc, eq, gte, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { DatabaseNotConfiguredError, isDatabaseConfigured, withTenant } from "@/db/client";
import { customers } from "@/db/schema";
import type { Customer, CustomerListItem, CustomerProfile, CustomerSort, CustomerStats } from "./schema";

/** Fields written for a customer; `phone`/`phoneKey` come from schema.normalizePhone. */
export type CustomerWrite = {
  name: string;
  phone: string;
  phoneKey: string;
  email: string | null;
  birthday: string | null;
  gender: CustomerProfile["gender"];
  notes: string | null;
};

export type WriteResult = { ok: true; id: string } | { ok: false; reason: "duplicate_phone" | "not_found" };

/** Writes always need a real database; call first so demo mode fails before any other work. */
export function assertWritable(): void {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
}

export function dataSource(): "database" | "demo" {
  return isDatabaseConfigured() ? "database" : "demo";
}

const listColumns = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  email: customers.email,
  visitCount: customers.visitCount,
  createdAt: customers.createdAt,
};

const ORDER: Record<CustomerSort, SQL[]> = {
  recent: [desc(customers.createdAt), asc(customers.id)],
  name: [asc(customers.name), asc(customers.id)],
  visits: [desc(customers.visitCount), asc(customers.name), asc(customers.id)],
};

/** Escape LIKE wildcards so a search for "100%" matches literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}

function searchCondition(q: string | undefined): SQL | undefined {
  if (!q) return undefined;
  const pattern = likePattern(q);
  const digits = q.replace(/\D/g, "");
  return or(
    ilike(customers.name, pattern),
    ilike(customers.email, pattern),
    // Phone search compares digits, so "98450 12" finds "+919845012345".
    digits.length >= 3 ? ilike(customers.phoneKey, likePattern(digits)) : undefined,
  );
}

type Page = { q?: string; sort: CustomerSort; limit: number; offset: number };

export async function list(tenantId: string, { q, sort, limit, offset }: Page): Promise<{ rows: CustomerListItem[]; matching: number }> {
  if (!isDatabaseConfigured()) return { rows: [], matching: 0 };
  const where = and(eq(customers.tenantId, tenantId), searchCondition(q));
  return withTenant(tenantId, async (tx) => {
    const [rows, [total]] = await Promise.all([
      tx.select(listColumns).from(customers).where(where).orderBy(...ORDER[sort]).limit(limit).offset(offset),
      tx.select({ n: count() }).from(customers).where(where),
    ]);
    return { rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), matching: total?.n ?? 0 };
  });
}

/** Light lookup list (booking form, search); no counts. */
export async function search(tenantId: string, { q, sort, limit, offset }: Page): Promise<Customer[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email, visitCount: customers.visitCount })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), searchCondition(q)))
      .orderBy(...ORDER[sort])
      .limit(limit)
      .offset(offset),
  );
}

export async function stats(tenantId: string, monthStart: Date): Promise<CustomerStats> {
  if (!isDatabaseConfigured()) return { total: 0, newThisMonth: 0, returning: 0 };
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        total: count(),
        newThisMonth: count(sql`case when ${gte(customers.createdAt, monthStart)} then 1 end`),
        returning: count(sql`case when ${customers.visitCount} >= 2 then 1 end`),
      })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));
    return { total: row?.total ?? 0, newThisMonth: row?.newThisMonth ?? 0, returning: row?.returning ?? 0 };
  });
}

export async function findById(tenantId: string, id: string): Promise<CustomerProfile | null> {
  if (!isDatabaseConfigured()) return null;
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({ ...listColumns, birthday: customers.birthday, gender: customers.gender, notes: customers.notes })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .limit(1);
    return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
  });
}

/** Postgres unique-violation on the per-tenant phone index (the backstop for concurrent writes). */
function isPhoneKeyConflict(error: unknown): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const { code, constraint_name, constraint } = e as { code?: string; constraint_name?: string; constraint?: string };
    if (code === "23505" && (constraint_name ?? constraint) === "customers_tenant_phone_key_uq") return true;
  }
  return false;
}

export async function insert(tenantId: string, data: CustomerWrite): Promise<WriteResult> {
  assertWritable();
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .insert(customers)
      .values({ tenantId, ...data })
      // The partial unique index decides duplicates atomically; no check-then-insert race.
      .onConflictDoNothing({ target: [customers.tenantId, customers.phoneKey], where: sql`${customers.phoneKey} is not null` })
      .returning({ id: customers.id });
    return row ? { ok: true as const, id: row.id } : { ok: false as const, reason: "duplicate_phone" as const };
  });
}

export async function update(tenantId: string, id: string, data: CustomerWrite): Promise<WriteResult> {
  assertWritable();
  try {
    return await withTenant(tenantId, async (tx) => {
      const [clash] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.phoneKey, data.phoneKey), ne(customers.id, id)))
        .limit(1);
      if (clash) return { ok: false as const, reason: "duplicate_phone" as const };

      const [row] = await tx
        .update(customers)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .returning({ id: customers.id });
      return row ? { ok: true as const, id: row.id } : { ok: false as const, reason: "not_found" as const };
    });
  } catch (error) {
    // Only the lost race against a concurrent write of the same phone is translated; everything else propagates.
    if (isPhoneKeyConflict(error)) return { ok: false, reason: "duplicate_phone" };
    throw error;
  }
}
