import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { CustomersDirectory } from "@/components/views/customers/customers-directory";
import { CustomersFilterBar } from "@/components/views/customers/customers-filters";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getCustomerDirectory } from "@/server/customers/queries";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { customers, stats, filters, filtered, source, page, pageCount, matching, pageSize } = await getCustomerDirectory(await searchParams);
  const readOnly = source === "demo";

  return (
    <>
      <PageHeader
        title="Customers"
        description="Your client book — contact details and visit counts."
        meta={<DemoDataBadge source={source} />}
        actions={
          readOnly ? undefined : (
            <ButtonLink href="/customers/new" icon="plus">
              Add Customer
            </ButtonLink>
          )
        }
      />

      <section aria-label="Customer summary" className="mb-8 grid grid-cols-1 gap-gutter sm:grid-cols-3">
        <StatTile label="Total customers" value={stats.total} icon="users" />
        <StatTile label="New this month" value={stats.newThisMonth} icon="trending-up" />
        <StatTile label="Returning" value={stats.returning} hint="Two or more visits" icon="user" />
      </section>

      <CustomersFilterBar filters={filters} />
      <CustomersDirectory
        customers={customers}
        filters={filters}
        filtered={filtered}
        readOnly={readOnly}
        page={page}
        pageCount={pageCount}
        matching={matching}
        pageSize={pageSize}
      />
    </>
  );
}
