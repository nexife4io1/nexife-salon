import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Appointments } from "@/components/views/appointments/appointments";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { requireTenantContext } from "@/server/shared/context";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  await requireTenantContext("appointments");

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

      <Appointments />
    </>
  );
}
