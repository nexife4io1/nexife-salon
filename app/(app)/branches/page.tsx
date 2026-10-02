import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { BranchGrid } from "@/components/views/branches/branch-grid";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getBranchesOverview } from "@/server/branches/queries";

export const metadata: Metadata = { title: "Branches" };

/** Reference page for the new design system — see Materials/code.html. */
export default async function BranchesPage() {
  const { branches, currency, source, canManage } = await getBranchesOverview();

  return (
    <>
      <PageHeader
        title="Branches"
        description="Monitor your salon locations and today's branch performance."
        meta={<DemoDataBadge source={source} />}
        actions={
          canManage && (
            <ButtonLink href="/branches/new" icon="plus">
              Add New Branch
            </ButtonLink>
          )
        }
      />
      <BranchGrid branches={branches} currency={currency} canManage={canManage} />
    </>
  );
}
