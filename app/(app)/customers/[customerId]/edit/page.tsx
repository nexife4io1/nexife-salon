import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/views/customers/customer-form";
import { updateCustomerAction } from "@/server/customers/actions";
import { getCustomerFormOptions, getCustomerProfile } from "@/server/customers/queries";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const [customer, { source }] = await Promise.all([getCustomerProfile(customerId), getCustomerFormOptions()]);

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <ButtonLink href={`/customers/${customer.id}`} variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to profile
        </ButtonLink>
        <PageHeader title={`Edit ${customer.name}`} description="Update this customer's details." />
      </div>
      {/* Keyed by id so navigating between customers re-seeds the uncontrolled inputs. */}
      <CustomerForm key={customer.id} action={updateCustomerAction} customer={customer} readOnly={source === "demo"} />
    </>
  );
}
