import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { BranchStatusBadge } from "@/components/views/branches/branch-status-badge";
import { TenantServices } from "@/components/views/platform/tenant-services";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { formatDate } from "@/lib/format";
import { getPlatformDataSource, getPlatformTenant, getServiceTemplates } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Tenant" };

export default async function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await getPlatformTenant(tenantId); // notFound() when it doesn't exist
  const [templates, source] = await Promise.all([getServiceTemplates(), getPlatformDataSource()]);

  const associated = new Set(tenant.services.map((s) => s.templateId));
  const availableTemplates = templates.filter((t) => t.active && !associated.has(t.id));

  return (
    <>
      <ButtonLink href="/platform" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
        Tenants
      </ButtonLink>
      <PageHeader
        eyebrow="Tenant"
        title={tenant.name}
        meta={<DemoDataBadge source={source} />}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <code>{tenant.slug}</code>
            <span>{tenant.currency}</span>
            <span>{tenant.timezone}</span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={16} /> Created {formatDate(tenant.createdAt)}
            </span>
          </span>
        }
      />

      <div className="grid gap-gutter lg:grid-cols-2">
        <Card>
          <CardHeader title="Owners" description="People who can sign in and manage this tenant." />
          {tenant.owners.length === 0 ? (
            <EmptyState icon="user" title="No owners" description="This tenant has no owner account." className="py-8" />
          ) : (
            <ul className="space-y-4">
              {tenant.owners.map((owner) => (
                <li key={owner.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface">{owner.name}</p>
                    <p className="text-body-sm text-secondary">@{owner.username}</p>
                  </div>
                  <Badge tone="gold">Owner</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Branches" description="Locations this tenant operates." />
          {tenant.branches.length === 0 ? (
            <EmptyState icon="store" title="No branches" description="The owner can add locations from the Branches page." className="py-8" />
          ) : (
            <ul className="space-y-4">
              {tenant.branches.map((branch) => (
                <li key={branch.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface">{branch.name}</p>
                    <p className="inline-flex items-center gap-1.5 text-body-sm text-secondary">
                      <Icon name="map-pin" size={16} />
                      {branch.addressLine}
                      {branch.city ? `, ${branch.city}` : ""}
                    </p>
                  </div>
                  <BranchStatusBadge status={branch.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <TenantServices tenantId={tenant.id} currency={tenant.currency} services={tenant.services} availableTemplates={availableTemplates} />
      </div>
    </>
  );
}
