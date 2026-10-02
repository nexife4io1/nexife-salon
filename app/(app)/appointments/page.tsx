import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableShell } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { getTodaysAppointments } from "@/server/appointments/queries";

export const metadata: Metadata = { title: "Appointments" };

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export default async function AppointmentsPage() {
  const appointments = await getTodaysAppointments();

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Today's bookings and walk-ins across your branches."
        actions={
          <Button icon="plus" disabled title="Booking arrives in step 6">
            New Booking
          </Button>
        }
      />
      <PlaceholderNote step="step 6 (Appointments)">
        Day/week calendar, booking drawer (server/appointments/actions.ts → bookAppointmentAction), check-in flow and live updates via Supabase Realtime.
      </PlaceholderNote>

      <div className="mb-4 flex flex-wrap gap-2">
        {["All", "Booked", "Checked in", "In service", "Completed"].map((label, i) => (
          <Badge key={label} tone={i === 0 ? "gold" : "neutral"}>
            {label}
          </Badge>
        ))}
      </div>

      <TableShell
        columns={["Time", "Client", "Service", "Stylist", "Type", "Status"]}
        empty={<EmptyState icon="calendar" title="No appointments today" description="Bookings for today will be listed here." />}
      >
        {appointments.length > 0 &&
          appointments.map((a) => (
            <tr key={a.id}>
              <td className="px-6 py-4 font-semibold text-on-surface">{timeFmt.format(a.startsAt)}</td>
              <td className="px-6 py-4">{a.customerName ?? "Walk-in"}</td>
              <td className="px-6 py-4 text-secondary">{a.serviceName ?? "—"}</td>
              <td className="px-6 py-4 text-secondary">{a.staffName ?? "Unassigned"}</td>
              <td className="px-6 py-4 text-secondary capitalize">{a.type.replace("_", " ")}</td>
              <td className="px-6 py-4">
                <Badge tone={a.status === "completed" ? "success" : a.status === "cancelled" ? "error" : "neutral"}>{a.status.replace("_", " ")}</Badge>
              </td>
            </tr>
          ))}
      </TableShell>
    </>
  );
}
