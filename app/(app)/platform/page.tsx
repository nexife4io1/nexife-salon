import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TenantDirectory } from "@/components/views/platform/tenant-directory";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getPlatformDataSource, getPlatformTenants } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Tenants" };

/** Platform-admin entry: the tenant directory across the whole platform. */
export default async function PlatformPage() {
  const [tenants, source] = await Promise.all([getPlatformTenants(), getPlatformDataSource()]);

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Tenants"
        description="Every salon business on Nexife."
        meta={<DemoDataBadge source={source} />}
        actions={
          <ButtonLink href="/platform/new" icon="plus">
            Onboard Tenant
          </ButtonLink>
        }
      />
      <TenantDirectory tenants={tenants} />
    </>
  );
}
