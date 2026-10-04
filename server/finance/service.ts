import "server-only";
import * as repo from "./repository";
import type { FinanceSummary } from "./schema";

export async function getMonthToDate(tenantId: string, now = new Date()): Promise<FinanceSummary> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const entries = await repo.listSince(tenantId, monthStart);
  const incomeCents = entries.filter((e) => e.type === "income").reduce((a, e) => a + e.amountCents, 0);
  const expenseCents = entries.filter((e) => e.type === "expense").reduce((a, e) => a + e.amountCents, 0);
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents, entries };
}

// TODO(step 9): include payments revenue (via billing service), P&L by branch, export.
