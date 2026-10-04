import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { formatMoney } from "@/lib/format";
import { getStaffDirectory } from "@/server/staff/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Staff & Services" };

type ServiceRow = Awaited<ReturnType<typeof getStaffDirectory>>["services"][number];

function serviceColumns(currency: string): TableColumn<ServiceRow>[] {
  return [
    {
      key: "name",
      header: "Service",
      cellClassName: "font-semibold text-on-surface",
      renderCell: (service) => service.name,
    },
    {
      key: "category",
      header: "Category",
      renderCell: (service) => (service.category ? <Badge>{service.category}</Badge> : "-"),
    },
    {
      key: "duration",
      header: "Duration",
      cellClassName: "text-secondary",
      renderCell: (service) => `${service.durationMinutes} min`,
    },
    {
      key: "price",
      header: "Price",
      renderCell: (service) => formatMoney(service.priceCents, currency),
    },
  ];
}

export default async function StaffPage() {
  const [{ staff, services }, tenant] = await Promise.all([getStaffDirectory(), getCurrentTenant()]);
  const currency = tenant?.currency ?? "USD";

  return (
    <>
      <PageHeader
        title="Staff & Services"
        description="Your team, their branches, and the service menu clients book from."
        actions={
          <Button icon="plus" disabled title="Arrives in step 4">
            Add Team Member
          </Button>
        }
      />
      <PlaceholderNote step="step 4 (Staff + Services)">
        Team profiles, branch assignment, working hours and service catalog editing.
      </PlaceholderNote>

      <PageSection title="Team">
        {staff.length ? (
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
            {staff.map((s) => (
              <Card key={s.id} className="flex items-center gap-4">
                <Avatar name={s.name} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-on-surface">{s.name}</p>
                  <p className="text-body-sm text-secondary">{s.title ?? "Team member"}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="scissors" title="No team members listed" description="Staff records come from the database (run npm run db:seed)." />
          </Card>
        )}
      </PageSection>

      <PageSection title="Service menu">
        <TableShell columns={serviceColumns(currency)} rows={services} rowKey={(service) => service.id} empty={<EmptyState title="No services yet" />} />
      </PageSection>
    </>
  );
}
