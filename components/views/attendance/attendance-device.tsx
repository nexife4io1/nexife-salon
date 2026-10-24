"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { AttendanceLoginState } from "@/server/attendance/schema";

type DeviceAction = (prev: AttendanceLoginState, formData: FormData) => Promise<AttendanceLoginState>;

const timeFmt = (iso: string, timeZone: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
/** `date` is the tenant-local "YYYY-MM-DD"; noon UTC keeps it on the same calendar day in UTC. */
const dayFmt = (date: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

/** Hidden inputs for a mark action. `kind` is an input (not a button name) because React overrides a function-action button's name. */
function MarkFields({ creds, kind }: { creds: { salonCode: string; registrationCode: string; phone: string }; kind: "check_in" | "check_out" }) {
  return (
    <>
      <input type="hidden" name="salonCode" value={creds.salonCode} />
      <input type="hidden" name="registrationCode" value={creds.registrationCode} />
      <input type="hidden" name="phone" value={creds.phone} />
      <input type="hidden" name="kind" value={kind} />
    </>
  );
}

/**
 * Standalone mobile attendance page. There is no session: the credentials stay in this component's state and
 * are re-sent (and re-verified server-side) with every action, so nothing here is trusted.
 */
export function AttendanceDevice({ loginAction, markAction }: { loginAction: DeviceAction; markAction: DeviceAction }) {
  const [creds, setCreds] = useState({ salonCode: "", registrationCode: "", phone: "" });
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, undefined);
  const [markState, markFormAction, markPending] = useActionState(markAction, undefined);

  // Whichever response is newest wins; a failed mark keeps the last good session on screen.
  const lastOk = [loginState, markState].reverse().find((s) => s?.ok);
  const [signedOut, setSignedOut] = useState<AttendanceLoginState>(undefined);
  const session = lastOk?.ok && lastOk !== signedOut ? lastOk.session : null;
  const error = markState && !markState.ok ? markState : loginState && !loginState.ok ? loginState : null;
  const fieldErrors = loginState && !loginState.ok ? loginState.fieldErrors : undefined;

  const set = (key: keyof typeof creds) => (e: React.ChangeEvent<HTMLInputElement>) => setCreds((c) => ({ ...c, [key]: e.target.value }));

  if (!session) {
    return (
      <Card padding="lg">
        <form action={loginFormAction} className="flex flex-col gap-5" noValidate>
          <Field label="Salon code" htmlFor="salonCode" hint="Ask your manager if you are not sure." errors={fieldErrors?.salonCode}>
            <Input id="salonCode" name="salonCode" value={creds.salonCode} onChange={set("salonCode")} autoCapitalize="none" autoCorrect="off" required />
          </Field>
          <Field label="Registration code" htmlFor="registrationCode" errors={fieldErrors?.registrationCode}>
            <Input
              id="registrationCode"
              name="registrationCode"
              value={creds.registrationCode}
              onChange={set("registrationCode")}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              className="font-mono tracking-widest uppercase"
              required
            />
          </Field>
          <Field label="Mobile number" htmlFor="phone" errors={fieldErrors?.phone}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={creds.phone} onChange={set("phone")} required />
          </Field>
          {error && !fieldErrors && (
            <p role="alert" className="rounded-control bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container">
              {error.error}
            </p>
          )}
          <Button type="submit" size="md" fullWidth disabled={loginPending} trailingIcon={loginPending ? undefined : "arrow-right"}>
            {loginPending ? "Checking…" : "Continue"}
          </Button>
        </form>
      </Card>
    );
  }

  const { record, timezone } = session;
  const done = Boolean(record?.checkOutAt);

  return (
    <Card padding="lg">
      <div className="flex flex-col gap-5">
        <div>
          <p className="eyebrow mb-1">{session.salonName}</p>
          <h2 className="font-headline text-headline-md text-on-surface">Hi, {session.staffName}</h2>
          <p className="mt-1 text-body-sm text-secondary">{session.branchName ?? "No branch"} · {dayFmt(session.today)}</p>
        </div>

        {record ? (
          <div className="flex flex-col gap-2 rounded-card bg-surface-container-low p-4 text-body-sm">
            <Badge tone={done ? "neutral" : "success"} dot className="self-start">
              {done ? "Done for today" : "Checked in"}
            </Badge>
            <p className="flex items-center gap-2 text-on-surface">
              <Icon name="clock" size={16} /> In {timeFmt(record.checkInAt, timezone)}
              {record.checkOutAt && <> · Out {timeFmt(record.checkOutAt, timezone)}</>}
            </p>
          </div>
        ) : (
          <p className="text-body-sm text-secondary">You have not recorded attendance today.</p>
        )}

        {error && (
          <p role="alert" className="rounded-control bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container">
            {error.error}
          </p>
        )}

        {!record && (
          <form action={markFormAction}>
            <MarkFields creds={creds} kind="check_in" />
            <Button type="submit" size="md" fullWidth disabled={markPending} icon="clock">
              {markPending ? "Recording…" : "Record attendance for today"}
            </Button>
          </form>
        )}
        {record && !done && (
          <form action={markFormAction}>
            <MarkFields creds={creds} kind="check_out" />
            <Button type="submit" variant="secondary" size="md" fullWidth disabled={markPending}>
              {markPending ? "Recording…" : "Check out"}
            </Button>
          </form>
        )}
        <Button type="button" variant="ghost" size="sm" fullWidth onClick={() => { setSignedOut(lastOk); setCreds({ salonCode: creds.salonCode, registrationCode: "", phone: "" }); }}>
          Not you? Sign out
        </Button>
      </div>
    </Card>
  );
}
