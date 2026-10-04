"use client";

import { useQuery } from "@tanstack/react-query";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, SmartBlock } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { fetchJson } from "@/components/views/shared/fetch-json";
import { queryKeys } from "@/components/views/shared/query-keys";
import { formatMoney } from "@/lib/format";
import type { DashboardSummary } from "@/server/dashboard/schema";

type DashboardSummaryResponse = DashboardSummary & { userName: string };

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

async function loadDashboardSummary() {
  return fetchJson<DashboardSummaryResponse>("/api/dashboard/summary");
}

export function Dashboard() {
  const { data, error, isPending } = useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: loadDashboardSummary,
  });

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={`${greeting()}, ${data?.userName.split(" ")[0] ?? "there"}`}
        description="Here's how your salon is doing today."
        meta={data ? <DemoDataBadge source={data.source} /> : undefined}
      />

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue today" value={data ? formatMoney(data.revenueTodayCents, data.currency) : "-"} icon="banknote" hint="Across all branches" />
        <StatTile label="Appointments" value={data ? data.appointmentsToday : "-"} icon="calendar" hint="Booked for today" />
        <StatTile label="Staff on roster" value={data ? data.staffOnRoster : "-"} icon="users" hint="Active team members" />
        <StatTile label="Branches" value={data ? data.branchCount : "-"} icon="store" hint="Locations you manage" />
      </div>

      {error && (
        <Card className="mt-gutter">
          <EmptyState icon="chart" title="Dashboard unavailable" description={error instanceof Error ? error.message : "Try again in a moment."} />
        </Card>
      )}

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
          <EmptyState
            icon="clock"
            title={isPending ? "Preparing your schedule" : "Nothing scheduled yet"}
            description={
              isPending
                ? "Live appointment highlights will appear here once today's timeline is loaded."
                : "Upcoming appointments will appear here once booking is live."
            }
          />
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
