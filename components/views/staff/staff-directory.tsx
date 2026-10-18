import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { STAFF_JOB_ROLE_LABELS, type StaffListItem } from "@/server/staff/schema";
import { StaffAvailabilityBadge } from "./staff-availability-badge";
import { StaffStatusSelect } from "./staff-status-select";

function columns(readOnly: boolean): TableColumn<StaffListItem>[] {
  return [
    {
      key: "member",
      header: "Staff member",
      renderCell: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-on-surface">{s.name}</p>
            <p className="truncate text-label-sm text-secondary">{s.title ?? (s.jobRole ? STAFF_JOB_ROLE_LABELS[s.jobRole] : "Team member")}</p>
          </div>
        </div>
      ),
    },
    { key: "branch", header: "Branch", cellClassName: "text-secondary", renderCell: (s) => s.branchName ?? "Unassigned" },
    { key: "status", header: "Status", renderCell: (s) => <StaffAvailabilityBadge availability={s.availability} /> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      renderCell: (s) => (
        <div className="inline-flex items-center gap-4">
          <Link href={`/staff/${s.id}`} className="text-label-md text-primary hover:underline" aria-label={`Open profile for ${s.name}`}>
            Profile
          </Link>
          <StaffStatusSelect staffId={s.id} name={s.name} status={s.status} disabled={readOnly} />
        </div>
      ),
    },
  ];
}

export function StaffDirectory({ staff, filtered, readOnly }: { staff: StaffListItem[]; filtered: boolean; readOnly: boolean }) {
  return (
    <TableShell
      columns={columns(readOnly)}
      rows={staff}
      rowKey={(s) => s.id}
      empty={
        filtered ? (
          <EmptyState
            icon="search"
            title="No staff match your filters"
            description="Try a different search, branch or status."
            action={
              <ButtonLink href="/staff" variant="secondary">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon="users"
            title="No team members yet"
            description={readOnly ? "Staff records come from the database (set DATABASE_URL, then run npm run db:seed)." : "Add your first team member to start building schedules."}
            action={
              readOnly ? undefined : (
                <ButtonLink href="/staff/new" icon="plus">
                  Add Staff
                </ButtonLink>
              )
            }
          />
        )
      }
    />
  );
}
