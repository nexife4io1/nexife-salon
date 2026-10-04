import type { Metadata } from "next";
import { Branches } from "@/components/views/branches/branches";
import { requireTenantContext } from "@/server/shared/context";

export const metadata: Metadata = { title: "Branches" };

/** Reference page for the new design system — see Materials/code.html. */
export default async function BranchesPage() {
  await requireTenantContext("branches");

  return (
    <Branches />
  );
}
