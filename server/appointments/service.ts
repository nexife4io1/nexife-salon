import "server-only";
import { utcDayRange } from "@/lib/dates";
import * as repo from "./repository";

export function countTodayByBranch(tenantId: string, now = new Date()) {
  const { start, end } = utcDayRange(now);
  return repo.countByBranchBetween(tenantId, start, end);
}

export function listToday(tenantId: string, now = new Date()) {
  const { start, end } = utcDayRange(now);
  return repo.listBetween(tenantId, start, end);
}

// TODO(step 6): book(), reschedule(), changeStatus() with slot/staff conflict checks.
// TODO(step 12): publish changes via Supabase Realtime for live calendars.
