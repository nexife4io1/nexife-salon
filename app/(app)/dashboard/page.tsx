import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, SmartBlock } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { formatMoney } from "@/lib/format";
import { getDashboardSummary } from "@/server/dashboard/queries";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={`${greeting()}, ${summary.userName.split(" ")[0]}`}
        description="Here's how your salon is doing today."
        meta={<DemoDataBadge source={summary.source} />}
      />

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue today" value={formatMoney(summary.revenueTodayCents, summary.currency)} icon="banknote" hint="Across all branches" />
        <StatTile label="Appointments" value={summary.appointmentsToday} icon="calendar" hint="Booked for today" />
        <StatTile label="Staff on roster" value={summary.staffOnRoster} icon="users" hint="Active team members" />
        <StatTile label="Branches" value={summary.branchCount} icon="store" hint="Locations you manage" />
      </div>

      <div className="mt-gutter grid gap-gutter lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Up next"
            description="The next appointments across your branches."
            action={
              <ButtonLink href="/appointments" variant="ghost" size="sm" trailingIcon="arrow-right">
                View all
              </ButtonLink>
            }
          />
          {/* TODO(step 3/6): list from server/appointments queries. */}
          <EmptyState icon="clock" title="Nothing scheduled yet" description="Upcoming appointments will appear here once booking is live." />
        </Card>

        <SmartBlock>
          <div className="mb-4 flex items-center gap-2 text-primary">
            <Icon name="sparkles" size={18} />
            <span className="eyebrow text-primary!">AI insight</span>
          </div>
          <p className="font-headline text-headline-sm text-on-surface">Smart suggestions are on the way</p>
          <p className="mt-2 text-body-sm text-secondary">
            Style Studio will surface quiet hours, rebooking nudges and stock alerts here, using your live salon data.
          </p>
          <ButtonLink href="/assistant" variant="accent" size="sm" icon="sparkles" className="mt-6">
            Open Style Studio
          </ButtonLink>
        </SmartBlock>
      </div>

      <PageSection
        title="Branch performance"
        description="Today's activity by location."
        action={
          <ButtonLink href="/branches" variant="ghost" size="sm" trailingIcon="arrow-right">
            All branches
          </ButtonLink>
        }
      >
        <Card>
          <EmptyState icon="trending-up" title="Charts arrive with the dashboard build-out" description="Roadmap step 3 adds trends and comparisons." />
        </Card>
      </PageSection>
    </>
  );
}
