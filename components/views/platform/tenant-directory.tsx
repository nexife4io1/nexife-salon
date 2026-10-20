"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import type { TenantSummary } from "@/server/tenants/schema";
import { TenantCard } from "./tenant-card";

/** Search box + card grid. Filtering is client-side: the directory is already fully loaded. */
export function TenantDirectory({ tenants }: { tenants: TenantSummary[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle ? tenants.filter((t) => t.name.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle)) : tenants;

  if (tenants.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="building"
          title="No tenants yet"
          description="Onboard the first salon business to give it an owner, a branch and a service menu."
          action={
            <ButtonLink href="/platform/new" icon="plus">
              Onboard Tenant
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <SearchField
        className="mb-8 max-w-md"
        placeholder="Search by name or slug"
        aria-label="Search tenants"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {visible.length === 0 ? (
        <Card>
          <EmptyState icon="search" title="No matching tenants" description={`Nothing matches "${query.trim()}".`} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {visible.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}
    </>
  );
}
