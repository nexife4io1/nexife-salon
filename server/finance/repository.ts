import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { financeEntries } from "@/db/schema";
import type { FinanceEntry } from "./schema";

export async function listSince(tenantId: string, sinceIsoDate: string): Promise<FinanceEntry[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({
        id: financeEntries.id,
        type: financeEntries.type,
        category: financeEntries.category,
        amountCents: financeEntries.amountCents,
        occurredOn: financeEntries.occurredOn,
        note: financeEntries.note,
      })
      .from(financeEntries)
      .where(and(eq(financeEntries.tenantId, tenantId), gte(financeEntries.occurredOn, sinceIsoDate)))
      .orderBy(desc(financeEntries.occurredOn)),
  );
}
