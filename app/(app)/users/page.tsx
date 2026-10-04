import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { getTenantUsers } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Users & Access" };

type TenantUserRow = Awaited<ReturnType<typeof getTenantUsers>>[number];

const USER_COLUMNS: TableColumn<TenantUserRow>[] = [
  {
    key: "name",
    header: "User",
    renderCell: (user) => (
      <span className="flex items-center gap-3">
        <Avatar name={user.name} size="sm" />
        <span className="font-semibold text-on-surface">{user.name}</span>
      </span>
    ),
  },
  {
    key: "username",
    header: "Username",
    cellClassName: "text-secondary",
    renderCell: (user) => <code>{user.username}</code>,
  },
  {
    key: "role",
    header: "Role",
    renderCell: (user) => <Badge tone={user.role === "owner" ? "gold" : "neutral"}>{user.role}</Badge>,
  },
  {
    key: "access",
    header: "Access",
    cellClassName: "text-secondary",
    renderCell: (user) => (user.menus.length ? `${user.menus.length} areas` : "Role defaults"),
  },
];

export default async function UsersPage() {
  const users = await getTenantUsers();

  return (
    <>
      <PageHeader
        title="Users & Access"
        description="Who can sign in, their role, and which areas they can see."
        actions={
          <Button icon="plus" disabled title="Arrives in step 10">
            Invite User
          </Button>
        }
      />
      <PlaceholderNote step="step 10 (Users / RBAC)">
        Invite users, assign roles and menu grants (server/shared/rbac.ts), reset passwords.
      </PlaceholderNote>

      <TableShell columns={USER_COLUMNS} rows={users} rowKey={(user) => user.id} empty={<EmptyState icon="shield" title="No users" />} />
    </>
  );
}
