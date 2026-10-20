import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { BookingForm } from "@/components/views/appointments/booking-form";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getBookingFormOptions } from "@/server/appointments/queries";
import { parseAppointmentFilters } from "@/server/appointments/schema";

export const metadata: Metadata = { title: "Book appointment" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const customerId = typeof raw.customerId === "string" ? raw.customerId : undefined;
  const options = await getBookingFormOptions(customerId);
  const { date, branchId } = parseAppointmentFilters(raw);
  const staffId = typeof raw.staffId === "string" ? raw.staffId : undefined;

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <ButtonLink href="/appointments" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Appointments
        </ButtonLink>
        <PageHeader
          title="Book Appointment"
          description="Schedule a service, assign a team member and reserve the slot."
          meta={<DemoDataBadge source={options.source} />}
        />
      </div>
      <BookingForm options={options} prefill={{ date, branchId, staffId, customerId }} />
    </>
  );
}
