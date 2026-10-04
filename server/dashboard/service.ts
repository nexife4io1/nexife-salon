import "server-only";
import * as branchesService from "@/server/branches/service";
import type { DashboardSummary } from "./schema";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Composes other domains' services. No repository: the dashboard owns no data.
 * TODO(step 3): trend vs. yesterday, upcoming appointments, AI insight block.
 */
export async function getSummary(tenantId: string): Promise<DashboardSummary> {
  const overview = await branchesService.getOverview(tenantId);
  return {
    currency: overview.currency,
    branchCount: overview.branches.length,
    appointmentsToday: sum(overview.branches.map((b) => b.appointmentsToday)),
    revenueTodayCents: sum(overview.branches.map((b) => b.revenueTodayCents)),
    staffOnRoster: sum(overview.branches.map((b) => b.staffCount)),
    source: overview.source,
  };
}
