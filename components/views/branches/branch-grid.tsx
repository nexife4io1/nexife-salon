import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { BranchOverview } from "@/server/branches/schema";
import { BranchCard } from "./branch-card";

export function BranchGrid({ branches, currency, canManage }: { branches: BranchOverview[]; currency: string; canManage: boolean }) {
  if (branches.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="store"
          title="No branches yet"
          description="Add your first location to start tracking staff, appointments and revenue per branch."
          action={
            canManage && (
              <ButtonLink href="/branches/new" icon="plus">
                Add New Branch
              </ButtonLink>
            )
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
      {branches.map((branch) => (
        <BranchCard key={branch.id} branch={branch} currency={currency} />
      ))}
    </div>
  );
}
