import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { getPlatformTenants } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Tenants" };

/** Platform-admin entry: the tenant directory across the whole platform. */
export default async function PlatformPage() {
  const tenants = await getPlatformTenants();

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Tenants"
        description="Every salon business on Nexife."
        actions={
          <Button icon="plus" disabled title="Arrives in step 1">
            Onboard Tenant
          </Button>
        }
      />
      <PlaceholderNote step="step 1 (Auth + Tenants)">
        Onboarding a tenant becomes a database insert (tenant + first owner) instead of editing a hardcoded array.
      </PlaceholderNote>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {tenants.map((t) => (
          <Card key={t.id}>
            <p className="font-headline text-headline-sm text-on-surface">{t.name}</p>
            <p className="mt-1 text-body-sm text-secondary">
              <code>{t.slug}</code> · {t.currency} · {t.timezone}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
