"use client";

import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { ActionResult } from "@/server/shared/result";

type BranchFormAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

export function BranchForm({ action }: { action: BranchFormAction }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;

  return (
    <form action={formAction} className="grid gap-6 md:grid-cols-2" noValidate>
      <div className="md:col-span-2">
        <Field label="Branch name" htmlFor="name" errors={fieldErrors?.name}>
          <Input id="name" name="name" placeholder="e.g. Downtown Flagship" required />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Street address" htmlFor="addressLine" errors={fieldErrors?.addressLine}>
          <Input id="addressLine" name="addressLine" placeholder="124 Main St, City Center" required />
        </Field>
      </div>
      <Field label="City" htmlFor="city" errors={fieldErrors?.city}>
        <Input id="city" name="city" />
      </Field>
      <Field label="Phone" htmlFor="phone" errors={fieldErrors?.phone}>
        <Input id="phone" name="phone" type="tel" />
      </Field>
      <Field label="Status" htmlFor="status" errors={fieldErrors?.status}>
        <Select id="status" name="status" defaultValue="active">
          <option value="active">Active</option>
          <option value="opening_soon">Opening soon</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>

      {state && !state.ok && state.error.code !== "VALIDATION" && (
        <p role="alert" className="rounded-control bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container md:col-span-2">
          {state.error.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 pt-6 md:col-span-2">
        <ButtonLink href="/branches" variant="ghost">
          Cancel
        </ButtonLink>
        <Button type="submit" icon="plus" disabled={pending}>
          {pending ? "Saving…" : "Create Branch"}
        </Button>
      </div>
    </form>
  );
}
