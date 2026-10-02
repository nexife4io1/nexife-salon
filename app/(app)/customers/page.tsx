import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchField } from "@/components/ui/search-field";
import { TableShell } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { getCustomers } from "@/server/customers/queries";

export const metadata: Metadata = { title: "Customers" };

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
        columns={["Name", "Phone", "Email", "Visits"]}
        empty={<EmptyState icon="users" title={q ? "No matches" : "No customers yet"} description="Clients you add or book will appear here." />}
      >
        {customers.length > 0 &&
          customers.map((c) => (
            <tr key={c.id}>
              <td className="px-6 py-4 font-semibold text-on-surface">{c.name}</td>
              <td className="px-6 py-4 text-secondary">{c.phone ?? "—"}</td>
              <td className="px-6 py-4 text-secondary">{c.email ?? "—"}</td>
              <td className="px-6 py-4">{c.visitCount}</td>
            </tr>
          ))}
      </TableShell>
    </>
  );
}
