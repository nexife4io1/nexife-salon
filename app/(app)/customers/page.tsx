import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchField } from "@/components/ui/search-field";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { getCustomers } from "@/server/customers/queries";

export const metadata: Metadata = { title: "Customers" };

type CustomerRow = Awaited<ReturnType<typeof getCustomers>>[number];

const CUSTOMER_COLUMNS: TableColumn<CustomerRow>[] = [
  {
    key: "name",
    header: "Name",
    cellClassName: "font-semibold text-on-surface",
    renderCell: (customer) => customer.name,
  },
  {
    key: "phone",
    header: "Phone",
    cellClassName: "text-secondary",
    renderCell: (customer) => customer.phone ?? "-",
  },
  {
    key: "email",
    header: "Email",
    cellClassName: "text-secondary",
    renderCell: (customer) => customer.email ?? "-",
  },
  {
    key: "visits",
    header: "Visits",
    renderCell: (customer) => customer.visitCount,
  },
];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const customers = await getCustomers(q);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Your client book — contact details, visit history and preferences."
        actions={
          <Button icon="plus" disabled title="Arrives in step 5">
            Add Customer
          </Button>
        }
      />
      <PlaceholderNote step="step 5 (Customers)">
        Client profiles, visit history, notes and phone de-duplication via server/customers.
      </PlaceholderNote>

      <form className="mb-4 max-w-md" role="search">
        <SearchField name="q" defaultValue={q} placeholder="Search by name…" aria-label="Search customers" />
      </form>

      <TableShell
        columns={CUSTOMER_COLUMNS}
        rows={customers}
        rowKey={(customer) => customer.id}
        empty={<EmptyState icon="users" title={q ? "No matches" : "No customers yet"} description="Clients you add or book will appear here." />}
      />
    </>
  );
}
