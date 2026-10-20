"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { setBranchServicesAction } from "@/server/branches/actions";
import type { BranchServicesView } from "@/server/branches/schema";
import { BranchServiceChecklist } from "./branch-service-checklist";

/** "Services offered" card on the branch detail page. Read-only for roles that can't manage branches. */
export function BranchServicesForm({ branchId, view }: { branchId: string; view: BranchServicesView }) {
  const [value, setValue] = useState(view.offeredIds);
  const [state, formAction, pending] = useActionState(setBranchServicesAction, undefined);
  const dirty = value.length !== view.offeredIds.length || value.some((id) => !view.offeredIds.includes(id));

  return (
    <Card padding="lg">
      <CardHeader title="Services offered" description="Which of your services customers can book at this branch." />
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="branchId" value={branchId} />
        <BranchServiceChecklist options={view.options} value={value} onChange={setValue} currency={view.currency} disabled={!view.canManage || pending} />

        {state && !state.ok && (
          <p role="alert" className="rounded-control bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container">
            {state.error.fieldErrors?.serviceIds?.[0] ?? state.error.message}
          </p>
        )}
        {state?.ok && !dirty && <p className="text-label-sm text-secondary">Saved.</p>}

        {view.canManage && view.options.length > 0 && (
          <div className="flex justify-end border-t border-outline-variant/20 pt-6">
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save services"}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
