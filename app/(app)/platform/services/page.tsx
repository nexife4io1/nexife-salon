import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceCatalog } from "@/components/views/platform/service-catalog";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getPlatformDataSource, getServiceTemplates } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Service catalog" };

/** Master catalog of service templates that tenants pick from during onboarding. */
export default async function ServiceCatalogPage() {
  const [templates, source] = await Promise.all([getServiceTemplates(), getPlatformDataSource()]);

  return (
    <>
      <ButtonLink href="/platform" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
        Tenants
      </ButtonLink>
      <PageHeader
        eyebrow="Platform"
        title="Service Catalog"
        description="Templates tenants choose from. Deactivating one hides it from new onboarding without touching tenants that already use it."
        meta={<DemoDataBadge source={source} />}
      />
      <ServiceCatalog templates={templates} readOnlyNote={source === "demo" ? "Demo mode is read-only — set DATABASE_URL to save templates." : undefined} />
    </>
  );
}
