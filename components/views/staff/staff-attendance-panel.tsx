"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import type { AttendanceRecord } from "@/server/attendance/schema";
import type { ActionResult } from "@/server/shared/result";

type CodeAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

const dateFmt = (iso: string, timeZone: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(iso));
const timeFmt = (iso: string, timeZone: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));

/** Registration code for the mobile attendance page, plus the staff member's recent attendance. */
export function StaffAttendancePanel({
  staffId,
  registrationCode,
  salonCode,
  timezone,
  records,
  action,
}: {
  staffId: string;
  registrationCode: string | null;
  salonCode: string;
  timezone: string;
  records: AttendanceRecord[];
  action: CodeAction;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="mx-auto mt-8 grid max-w-5xl gap-6">
      <Card padding="lg" className="p-6 md:p-8">
        <h2 className="mb-1 flex items-center gap-2 font-headline text-headline-sm font-semibold text-on-surface">
          <Icon name="shield" size={20} className="text-primary-container" />
          Attendance code
        </h2>
        <p className="mb-5 text-body-sm text-secondary">
          Staff open <code className="text-on-surface">/attendance</code> on their phone and sign in with the salon code, this code and their registered mobile number.
        </p>
        <form action={formAction} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={staffId} />
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1">
            <dt className="eyebrow">Salon code</dt>
            <dt className="eyebrow">Registration code</dt>
            <dd className="font-mono text-body-md text-on-surface">{salonCode}</dd>
            <dd className="font-mono text-body-md tracking-widest text-on-surface">{registrationCode ?? "Not generated"}</dd>
          </dl>
          <Button type="submit" variant="secondary" size="sm" disabled={pending} className="ml-auto">
            {pending ? "Generating…" : registrationCode ? "Regenerate code" : "Generate code"}
          </Button>
        </form>
        {registrationCode && <p className="mt-3 text-label-sm text-secondary">Regenerating immediately stops the old code from working.</p>}
        {state && !state.ok && (
          <p role="alert" className="mt-3 text-label-sm text-error">
            {state.error.message}
          </p>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <h2 className="px-6 pt-6 font-headline text-headline-sm font-semibold text-on-surface md:px-8">Attendance</h2>
        {records.length === 0 ? (
          <EmptyState icon="clock" title="No attendance yet" description="Records appear here once this staff member checks in from the mobile page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  {["Date", "Check-in", "Check-out"].map((h) => (
                    <th key={h} scope="col" className="eyebrow px-6 py-4 font-semibold md:px-8">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15 text-body-sm">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-on-surface md:px-8">{dateFmt(r.checkInAt, timezone)}</td>
                    <td className="px-6 py-3 md:px-8">{timeFmt(r.checkInAt, timezone)}</td>
                    <td className="px-6 py-3 text-secondary md:px-8">{r.checkOutAt ? timeFmt(r.checkOutAt, timezone) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
