/** Dashboard is a read-only composition of other domains; it owns no tables. */
export type DashboardSummary = {
  currency: string;
  branchCount: number;
  appointmentsToday: number;
  revenueTodayCents: number;
  staffOnRoster: number;
  source: "database" | "demo";
};
