import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AppointmentsBoard } from "@/components/views/appointments/appointments-board";
import { AppointmentsFilterBar } from "@/components/views/appointments/appointments-filters";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getAppointmentsBoard } from "@/server/appointments/queries";
import { getAppointmentBillingState } from "@/server/billing/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const board = await getAppointmentsBoard(await searchParams);
  const [billing, tenant] = await Promise.all([getAppointmentBillingState(board.appointments.map((a) => a.id)), getCurrentTenant()]);
  const readOnly = board.source === "demo";
  const bookParams = new URLSearchParams({ date: board.date });
  if (board.filters.branchId) bookParams.set("branchId", board.filters.branchId);

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Manage the schedule, staff assignments and walk-ins across your branches."
        meta={<DemoDataBadge source={board.source} />}
        actions={
          readOnly ? undefined : (
            <ButtonLink href={`/appointments/new?${bookParams}`} icon="plus">
              Book Appointment
            </ButtonLink>
          )
        }
      />
      <AppointmentsFilterBar board={board} />
      <AppointmentsBoard board={board} currency={tenant?.currency ?? "USD"} canCheckout={billing.canCheckout} receipts={billing.receipts} />
    </>
  );
}
