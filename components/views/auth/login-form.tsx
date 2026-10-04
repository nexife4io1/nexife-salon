"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { LoginState } from "@/server/auth/schema";

type LoginFormAction = (prev: LoginState, formData: FormData) => Promise<LoginState>;

export function LoginForm({ defaultUsername, action }: { defaultUsername?: string; action: LoginFormAction }) {
  const [state, formAction, pending] = useActionState(action, undefined);

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
