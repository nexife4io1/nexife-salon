import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StaffForm } from "@/components/views/staff/staff-form";
import { createStaffAction } from "@/server/staff/actions";
import { getStaffFormOptions } from "@/server/staff/queries";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  const options = await getStaffFormOptions();

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <ButtonLink href="/staff" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Staff Directory
        </ButtonLink>
        <PageHeader title="Add Staff" description="Create a staff profile and assign them to your salon team." />
      </div>
      <StaffForm key="new" action={createStaffAction} options={options} />
    </>
  );
}
