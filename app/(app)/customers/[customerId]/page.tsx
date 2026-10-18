import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerProfileView } from "@/components/views/customers/customer-profile";
import { getCustomerAppointments } from "@/server/appointments/queries";
import { getCustomerInvoices } from "@/server/billing/queries";
import { getCustomerProfile } from "@/server/customers/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Customer profile" };

export default async function CustomerProfilePage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const customer = await getCustomerProfile(customerId);
  const [appointments, billing, tenant] = await Promise.all([getCustomerAppointments(customer.id), getCustomerInvoices(customer.id), getCurrentTenant()]);

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <ButtonLink href="/customers" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Customers
        </ButtonLink>
        <PageHeader
          title={customer.name}
          description="Customer profile"
          actions={
            <>
              <ButtonLink href={`/appointments/new?customerId=${customer.id}`}variant="secondary" icon="calendar">
                Book Appointment
              </ButtonLink>
              <ButtonLink href={`/customers/${customer.id}/edit`}>Edit Customer</ButtonLink>
            </>
          }
        />
      </div>
      <CustomerProfileView customer={customer} activity={{ appointments, billing, currency: tenant?.currency ?? "USD", timezone: tenant?.timezone ?? "UTC" }} />
    </>
  );
}
