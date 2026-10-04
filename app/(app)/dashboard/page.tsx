import type { Metadata } from "next";
import { Dashboard } from "@/components/views/dashboard/dashboard";
import { requireTenantContext } from "@/server/shared/context";

export const metadata: Metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  await requireTenantContext("dashboard");

  return (
    <Dashboard />
  );
}
