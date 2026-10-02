import "server-only";
import { utcDayRange } from "@/lib/dates";
import * as repo from "./repository";

export function revenueTodayByBranch(tenantId: string, now = new Date()) {
  const { start, end } = utcDayRange(now);
  return repo.sumByBranchBetween(tenantId, start, end);
}

export function listRecentPayments(tenantId: string) {
  return repo.listRecent(tenantId);
}

// TODO(step 7): recordPayment() — insert payment + mark appointment completed in one transaction
// (calls appointments service, never its repository).
