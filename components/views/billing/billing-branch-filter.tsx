"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/field";

/** Branch filter for the payment history. Lives in the URL (shareable, back-button friendly) and applies immediately. */
export function BillingBranchFilter({ branches, branchId }: { branches: { id: string; name: string }[]; branchId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={branchId ?? ""}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => router.replace(next ? `/billing?branchId=${next}` : "/billing"));
      }}
      aria-label="Filter payments by branch"
      aria-busy={pending}
      className="h-10 md:w-56"
    >
      <option value="">All branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  );
}
