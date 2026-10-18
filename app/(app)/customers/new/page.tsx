import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/views/customers/customer-form";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { createCustomerAction } from "@/server/customers/actions";
import { getCustomerFormOptions } from "@/server/customers/queries";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ source }, { from }] = await Promise.all([getCustomerFormOptions(), searchParams]);
  const returnTo = from === "booking" ? "booking" : undefined;

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <ButtonLink href={returnTo ? "/appointments/new" : "/customers"} variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          {returnTo ? "Back to Book Appointment" : "Back to Customers"}
        </ButtonLink>
        <PageHeader title="Add Customer" description="Create a customer profile." meta={<DemoDataBadge source={source} />} />
      </div>
      <CustomerForm key="new" action={createCustomerAction} readOnly={source === "demo"} returnTo={returnTo} />
    </>
  );
}
