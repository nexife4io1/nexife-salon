import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableShell } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { getTenantUsers } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Users & Access" };

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

      <TableShell columns={["User", "Username", "Role", "Access"]} empty={<EmptyState icon="shield" title="No users" />}>
        {users.length > 0 &&
          users.map((u) => (
            <tr key={u.id}>
              <td className="px-6 py-4">
                <span className="flex items-center gap-3">
                  <Avatar name={u.name} size="sm" />
                  <span className="font-semibold text-on-surface">{u.name}</span>
                </span>
              </td>
              <td className="px-6 py-4 text-secondary">
                <code>{u.username}</code>
              </td>
              <td className="px-6 py-4">
                <Badge tone={u.role === "owner" ? "gold" : "neutral"}>{u.role}</Badge>
              </td>
              <td className="px-6 py-4 text-secondary">{u.menus.length ? `${u.menus.length} areas` : "Role defaults"}</td>
            </tr>
          ))}
      </TableShell>
    </>
  );
}
