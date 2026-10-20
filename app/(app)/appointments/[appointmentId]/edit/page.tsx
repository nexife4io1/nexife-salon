import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { BookingForm } from "@/components/views/appointments/booking-form";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getBookingFormOptions, getEditableAppointment } from "@/server/appointments/queries";

export const metadata: Metadata = { title: "Edit appointment" };

export default async function EditAppointmentPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const appointment = await getEditableAppointment(appointmentId);
  const options = await getBookingFormOptions(appointment.customerId ?? undefined);

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <ButtonLink href="/appointments" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Appointments
        </ButtonLink>
        <PageHeader
          title="Edit Appointment"
          description="Change the time, services, team member or notes. The same availability checks apply as for a new booking."
          meta={<DemoDataBadge source={options.source} />}
        />
      </div>
      {/* Keyed by id so the form state is re-seeded for a different appointment. */}
      <BookingForm key={appointment.id} options={options} editing={appointment} />
    </>
  );
}
