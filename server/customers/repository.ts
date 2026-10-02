import "server-only";
import { and, asc, eq, ilike } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { customers } from "@/db/schema";
import type { Customer, CustomerSearch } from "./schema";

export async function search(tenantId: string, { q, limit }: CustomerSearch): Promise<Customer[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email, visitCount: customers.visitCount })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), q ? ilike(customers.name, `%${q}%`) : undefined))
      .orderBy(asc(customers.name))
      .limit(limit),
  );
}
