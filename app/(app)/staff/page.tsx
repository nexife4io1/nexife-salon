import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { TableShell } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { formatMoney } from "@/lib/format";
import { getStaffDirectory } from "@/server/staff/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Staff & Services" };

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
        <TableShell columns={["Service", "Category", "Duration", "Price"]} empty={<EmptyState title="No services yet" />}>
          {services.length > 0 &&
            services.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-4 font-semibold text-on-surface">{s.name}</td>
                <td className="px-6 py-4">{s.category ? <Badge>{s.category}</Badge> : "—"}</td>
                <td className="px-6 py-4 text-secondary">{s.durationMinutes} min</td>
                <td className="px-6 py-4">{formatMoney(s.priceCents, currency)}</td>
              </tr>
            ))}
        </TableShell>
      </PageSection>
    </>
  );
}
