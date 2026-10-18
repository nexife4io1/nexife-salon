import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { formatDate, pluralize } from "@/lib/format";
import { customersHref, type CustomerFilters, type CustomerListItem } from "@/server/customers/schema";

const COLUMNS: TableColumn<CustomerListItem>[] = [
  {
    key: "name",
    header: "Customer",
    renderCell: (c) => (
      <Link href={`/customers/${c.id}`} className="flex items-center gap-3 rounded-control hover:text-primary focus-visible:outline-2 focus-visible:outline-primary-container">
        <Avatar name={c.name} />
        <span className="min-w-0 truncate font-semibold text-on-surface">{c.name}</span>
      </Link>
    ),
  },
  { key: "phone", header: "Phone", cellClassName: "text-secondary", renderCell: (c) => c.phone ?? "—" },
  { key: "email", header: "Email", cellClassName: "text-secondary", renderCell: (c) => c.email ?? "—" },
  { key: "visits", header: "Visits", align: "right", renderCell: (c) => c.visitCount },
  { key: "added", header: "Added", cellClassName: "text-secondary", renderCell: (c) => formatDate(c.createdAt) },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    renderCell: (c) => (
      <div className="inline-flex items-center gap-4">
        <Link href={`/customers/${c.id}`} className="text-label-md text-primary hover:underline" aria-label={`Open profile for ${c.name}`}>
          Profile
        </Link>
        <Link href={`/customers/${c.id}/edit`} className="text-label-md text-primary hover:underline" aria-label={`Edit ${c.name}`}>
          Edit
        </Link>
      </div>
    ),
  },
];

function Pagination({ filters, page, pageCount, matching, pageSize }: { filters: CustomerFilters; page: number; pageCount: number; matching: number; pageSize: number }) {
  if (matching === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, matching);
  const link = "text-label-md text-primary hover:underline";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-body-sm text-secondary">
      <p>
        Showing {from}–{to} of {pluralize(matching, "customer")}
      </p>
      <div className="flex items-center gap-4">
        {page > 1 && (
          <Link href={customersHref({ ...filters, page: page - 1 })} className={link} rel="prev">
            Previous
          </Link>
        )}
        <span aria-current="page">
          Page {page} of {pageCount}
        </span>
        {page < pageCount && (
          <Link href={customersHref({ ...filters, page: page + 1 })} className={link} rel="next">
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}

export function CustomersDirectory({
  customers,
  filters,
  filtered,
  readOnly,
  page,
  pageCount,
  matching,
  pageSize,
}: {
  customers: CustomerListItem[];
  filters: CustomerFilters;
  filtered: boolean;
  readOnly: boolean;
  page: number;
  pageCount: number;
  matching: number;
  pageSize: number;
}) {
  return (
    <>
      <TableShell
        columns={COLUMNS}
        rows={customers}
        rowKey={(c) => c.id}
        empty={
          filtered ? (
            <EmptyState
              icon="search"
              title="No customers match your search"
              description="Try a different name, phone number or email."
              action={
                <ButtonLink href="/customers" variant="secondary">
                  Clear search
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon="users"
              title="No customers yet"
              description={readOnly ? "Customer records come from the database (set DATABASE_URL to use them)." : "Add your first customer to start building your client book."}
              action={
                readOnly ? undefined : (
                  <ButtonLink href="/customers/new" icon="plus">
                    Add Customer
                  </ButtonLink>
                )
              }
            />
          )
        }
      />
      <Pagination filters={filters} page={page} pageCount={pageCount} matching={matching} pageSize={pageSize} />
    </>
  );
}
