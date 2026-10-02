"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginAction } from "@/server/auth/actions";

export function LoginForm({ defaultUsername }: { defaultUsername?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label="Username" htmlFor="username" errors={state?.fieldErrors?.username}>
        <Input id="username" name="username" autoComplete="username" defaultValue={defaultUsername} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" errors={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-control bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container">
          {state.error}
        </p>
      )}
      <Button type="submit" size="md" fullWidth disabled={pending} trailingIcon={pending ? undefined : "arrow-right"} className="mt-2">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
