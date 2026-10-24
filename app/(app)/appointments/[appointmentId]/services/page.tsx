import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceLines } from "@/components/views/appointments/service-lines";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getAppointmentServices } from "@/server/appointments/queries";

export const metadata: Metadata = { title: "Appointment services" };

export default async function AppointmentServicesPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const view = await getAppointmentServices(appointmentId);

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <ButtonLink href="/appointments" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Appointments
        </ButtonLink>
        <PageHeader
          title="Services"
          description="Add services, start and finish each one, and change who is doing it, during and after the visit."
          meta={<DemoDataBadge source={view.source} />}
        />
      </div>
      <ServiceLines key={view.appointment.id} view={view} />
    </>
  );
}
