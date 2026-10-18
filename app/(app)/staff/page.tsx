import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { StaffDirectory } from "@/components/views/staff/staff-directory";
import { StaffFilterBar } from "@/components/views/staff/staff-filters";
import { getStaffDirectory } from "@/server/staff/queries";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff, branches, filters, filtered, source } = await getStaffDirectory(await searchParams);
  const readOnly = source === "demo";

  return (
    <>
      <PageHeader
        title="Staff"
        description="Manage your salon team and staff assignments."
        meta={<DemoDataBadge source={source} />}
        actions={
          readOnly ? undefined : (
            <ButtonLink href="/staff/new" icon="plus">
              Add Staff
            </ButtonLink>
          )
        }
      />

      <StaffFilterBar filters={filters} branches={branches} />
      <StaffDirectory staff={staff} filtered={filtered} readOnly={readOnly} />
    </>
  );
}
