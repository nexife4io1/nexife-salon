import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { BranchStatusBadge } from "@/components/views/branches/branch-status-badge";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { BranchServicesForm } from "@/components/views/branches/branch-services-form";
import { getBranchDetail, getBranchServicesView } from "@/server/branches/queries";

export const metadata: Metadata = { title: "Branch" };

export default async function BranchDetailPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;
  const [branch, servicesView] = await Promise.all([getBranchDetail(branchId), getBranchServicesView(branchId)]);

  return (
    <>
      <ButtonLink href="/branches" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
        Branches
      </ButtonLink>
      <PageHeader
        title={branch.name}
        meta={<BranchStatusBadge status={branch.status} />}
        description={
          <span className="inline-flex items-center gap-2">
            <Icon name="map-pin" size={18} /> {branch.addressLine}
            {branch.city ? `, ${branch.city}` : ""}
          </span>
        }
      />
      <PlaceholderNote step="step 2 (Branches refinement)">
        Branch detail will show the day&apos;s schedule, team on shift, and performance trends for this location.
      </PlaceholderNote>

      <div className="grid gap-gutter lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Today's schedule" description="Appointments booked at this branch." />
          <EmptyState icon="calendar" title="Schedule coming soon" description="Wire to server/appointments once booking lands (step 6)." />
        </Card>
        <Card>
          <CardHeader title="Team on shift" />
          <EmptyState icon="users" title="No roster yet" description="Staff assignment arrives with step 4." />
        </Card>
      </div>

      <PageSection title="Services">
        <BranchServicesForm branchId={branch.id} view={servicesView} />
      </PageSection>

      <PageSection title="Performance" description="Revenue, utilisation and rebooking rate over time.">
        <Card>
          <EmptyState icon="trending-up" title="Trends will appear here" description="Fed by billing + appointments services." />
        </Card>
      </PageSection>
    </>
  );
}
