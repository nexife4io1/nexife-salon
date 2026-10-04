"use client";

import { useQuery } from "@tanstack/react-query";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BranchGrid } from "@/components/views/branches/branch-grid";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { fetchJson } from "@/components/views/shared/fetch-json";
import { queryKeys } from "@/components/views/shared/query-keys";
import type { BranchesOverview } from "@/server/branches/schema";

type BranchesOverviewResponse = BranchesOverview & { canManage: boolean };

async function loadBranchesOverview() {
  return fetchJson<BranchesOverviewResponse>("/api/branches/overview");
}

export function Branches() {
  const { data, error, isPending } = useQuery({
    queryKey: queryKeys.branchesOverview,
    queryFn: loadBranchesOverview,
  });

  return (
    <>
      <PageHeader
        title="Branches"
        description="Monitor your salon locations and today's branch performance."
        meta={data ? <DemoDataBadge source={data.source} /> : undefined}
        actions={
          data?.canManage && (
            <ButtonLink href="/branches/new" icon="plus">
              Add New Branch
            </ButtonLink>
          )
        }
      />

      {isPending && (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56 rounded-card" />
          ))}
        </div>
      )}

      {error && !isPending && (
        <Card>
          <EmptyState icon="store" title="Branches unavailable" description={error instanceof Error ? error.message : "Try again in a moment."} />
        </Card>
      )}

      {data && !isPending && !error && <BranchGrid branches={data.branches} currency={data.currency} canManage={data.canManage} />}
    </>
  );
}
