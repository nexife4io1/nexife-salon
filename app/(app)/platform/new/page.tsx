import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { OnboardTenantForm } from "@/components/views/platform/onboard-tenant-form";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getPlatformDataSource, getServiceTemplates } from "@/server/tenants/queries";
import { CURRENCIES, TIMEZONES } from "@/server/tenants/schema";

export const metadata: Metadata = { title: "Onboard tenant" };

export default async function OnboardTenantPage() {
  const [templates, source] = await Promise.all([getServiceTemplates(), getPlatformDataSource()]);

  return (
    <>
      <ButtonLink href="/platform" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
        Tenants
      </ButtonLink>
      <PageHeader
        title="Onboard Tenant"
        description={
          source === "demo"
            ? "Demo mode is read-only — set DATABASE_URL to onboard tenants."
            : "Create a salon business with its first owner, branch and service menu in one step."
        }
        meta={<DemoDataBadge source={source} />}
      />
      <OnboardTenantForm templates={templates.filter((t) => t.active)} currencies={CURRENCIES} timezones={TIMEZONES} />
    </>
  );
}
