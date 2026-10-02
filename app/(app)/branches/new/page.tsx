import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BranchForm } from "@/components/views/branches/branch-form";
import { getBranchesOverview } from "@/server/branches/queries";

export const metadata: Metadata = { title: "Add branch" };

export default async function NewBranchPage() {
  const { canManage, source } = await getBranchesOverview();
  if (!canManage) redirect("/branches");

  return (
    <div className="max-w-3xl">
      <ButtonLink href="/branches" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
        Branches
      </ButtonLink>
      <PageHeader title="Add New Branch" description="Set up a new location. You can assign staff and services once it's created." />
      <Card padding="lg">
        <CardHeader
          title="Location details"
          description={source === "demo" ? "Demo mode is read-only — set DATABASE_URL to save branches." : undefined}
        />
        <BranchForm />
      </Card>
    </div>
  );
}
