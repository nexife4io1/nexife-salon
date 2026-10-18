import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StaffAvailabilityBadge } from "@/components/views/staff/staff-availability-badge";
import { StaffForm } from "@/components/views/staff/staff-form";
import { updateStaffAction } from "@/server/staff/actions";
import { getStaffFormOptions, getStaffProfile } from "@/server/staff/queries";

export const metadata: Metadata = { title: "Staff profile" };

export default async function StaffProfilePage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  const [profile, options] = await Promise.all([getStaffProfile(staffId), getStaffFormOptions()]);

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <ButtonLink href="/staff" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Staff Directory
        </ButtonLink>
        <PageHeader
          title={profile.name}
          description={profile.branchName ? `${profile.title ?? "Team member"} · ${profile.branchName}` : (profile.title ?? "Team member")}
          meta={<StaffAvailabilityBadge availability={profile.availability} />}
        />
      </div>
      {/* Keyed by id so navigating between profiles re-seeds the uncontrolled inputs. */}
      <StaffForm key={profile.id} action={updateStaffAction} options={options} profile={profile} />
    </>
  );
}
