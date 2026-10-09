import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatDate } from "@/lib/format";
import type { TenantSummary } from "@/server/tenants/schema";

/** One tenant in the platform directory — same card anatomy as the Branches page. */
export function TenantCard({ tenant }: { tenant: TenantSummary }) {
  const counts: Array<{ icon: IconName; value: number; label: string }> = [
    { icon: "store", value: tenant.branchCount, label: "Branches" },
    { icon: "users", value: tenant.userCount, label: "Users" },
    { icon: "scissors", value: tenant.serviceCount, label: "Services" },
  ];

  return (
    <Card interactive className="flex h-full flex-col">
      <div className="mb-6">
        <h3 className="font-headline text-headline-md font-semibold text-on-surface">{tenant.name}</h3>
        <p className="mt-1 text-body-sm text-secondary">
          <code>{tenant.slug}</code> · {tenant.currency} · {tenant.timezone}
        </p>
      </div>

      <dl className="grid flex-1 grid-cols-3 gap-4">
        {counts.map(({ icon, value, label }) => (
          <div key={label} className="flex flex-col gap-1 text-secondary">
            <Icon name={icon} size={20} />
            <dd className="font-headline text-headline-sm font-semibold text-on-surface">{value}</dd>
            <dt className="text-label-sm">{label}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-6 flex items-center gap-2 text-label-sm text-secondary">
        <Icon name="calendar" size={16} /> Created {formatDate(tenant.createdAt)}
      </p>

      <ButtonLink href={`/platform/${tenant.id}`} variant="secondary" size="sm" fullWidth trailingIcon="arrow-right" className="mt-4 h-10">
        View Tenant
      </ButtonLink>
    </Card>
  );
}
