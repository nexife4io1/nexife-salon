import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { TableShell } from "@/components/ui/table-shell";
import { addDaysToDateString } from "@/lib/dates";
import { getShiftAttendanceStatus, type AttendanceBoard, type AttendanceStaff } from "@/server/attendance/schema";
import { WEEKDAY_LABELS } from "@/server/attendance/schema";
import {
  addRecurringShiftAction,
  createLeaveAction,
  recordAttendanceAction,
  removeLeaveAction,
  removeRecurringShiftAction,
} from "@/server/attendance/actions";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { ActionForm } from "./action-form";

const statusFor = (member: AttendanceStaff, hasAttendance: boolean) => {
  const status = getShiftAttendanceStatus(hasAttendance, Boolean(member.leave));
  if (status === "present") return { label: "Present", tone: "success" as const };
  if (status === "leave") return { label: "Leave", tone: "warning" as const };
  return { label: "Unmarked", tone: "neutral" as const };
};

function StaffAttendanceCard({ member, date }: { member: AttendanceStaff; date: string }) {
  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={member.name} />
          <div>
            <h3 className="font-semibold text-on-surface">{member.name}</h3>
            <p className="text-label-sm text-secondary">{member.branchName ?? "Unassigned branch"}</p>
          </div>
        </div>
        {member.leave && <Badge tone="warning">On leave for this date</Badge>}
      </div>

      {member.shifts.length ? (
        <div className="space-y-3">
          {member.shifts.map((shift) => {
            const status = statusFor(member, Boolean(shift.attendance));
            return (
              <div key={shift.id} className="grid gap-4 rounded-control bg-surface-container-low p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="font-semibold text-on-surface">{shift.start}–{shift.end}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {shift.attendance?.clockOut ? (
                    <p className="text-label-sm text-secondary">Recorded {shift.attendance.clockIn}–{shift.attendance.clockOut}</p>
                  ) : shift.attendance ? (
                    <p className="text-label-sm text-secondary">Clocked in {shift.attendance.clockIn}; clock-out not recorded</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <ActionForm action={recordAttendanceAction} submitText={shift.attendance ? "Update attendance" : "Record present"} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="staffId" value={member.id} />
                    <input type="hidden" name="shiftId" value={shift.id} />
                    <input type="hidden" name="workDate" value={date} />
                    <Field label="Clock-in" htmlFor={`in-${shift.id}`}>
                      <Input id={`in-${shift.id}`} name="clockIn" type="time" required defaultValue={shift.attendance?.clockIn ?? shift.start} className="w-32" />
                    </Field>
                    <Field label="Clock-out" htmlFor={`out-${shift.id}`} hint="Optional until the shift ends">
                      <Input id={`out-${shift.id}`} name="clockOut" type="time" defaultValue={shift.attendance?.clockOut ?? ""} className="w-32" />
                    </Field>
                    <Field label="Note" htmlFor={`note-${shift.id}`}>
                      <Input id={`note-${shift.id}`} name="note" maxLength={300} defaultValue={shift.attendance?.note ?? ""} placeholder="Optional" className="w-40" />
                    </Field>
                  </ActionForm>
                  <ActionForm action={removeRecurringShiftAction} submitText="Remove recurring shift" className="contents">
                    <input type="hidden" name="shiftId" value={shift.id} />
                  </ActionForm>
                </div>
              </div>
            );
          })}
        </div>
      ) : member.leave ? (
        <p className="rounded-control bg-warning-container/50 px-4 py-3 text-body-sm text-on-surface-variant">
          Leave recorded{member.leave.reason ? `: ${member.leave.reason}` : ""}. Attendance can still be recorded if they worked.
        </p>
      ) : (
        <p className="rounded-control bg-surface-container-low px-4 py-3 text-body-sm text-secondary">
          No recurring shift scheduled for this weekday.
        </p>
      )}
    </Card>
  );
}

export function AttendanceManagement({
  board,
  staffOptions,
}: {
  board: AttendanceBoard;
  staffOptions: { id: string; name: string }[];
}) {
  const previousDate = addDaysToDateString(board.date, -1);
  const nextDate = addDaysToDateString(board.date, 1);
  const dayLabel = WEEKDAY_LABELS[board.day]!;
  const readOnly = board.source === "demo";

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Track each shift, manage recurring schedules, and record dated leave."
        meta={<DemoDataBadge source={board.source} />}
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href={`/attendance?date=${previousDate}`} variant="secondary" size="sm" icon="arrow-left">Previous day</ButtonLink>
            <ButtonLink href={`/attendance?date=${nextDate}`} variant="secondary" size="sm" trailingIcon="arrow-right">Next day</ButtonLink>
          </div>
        }
      />

      <Card className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Selected day</p>
          <p className="font-headline text-headline-sm font-semibold text-on-surface">{dayLabel}, {board.date}</p>
        </div>
        <form action="/attendance" className="flex items-end gap-3">
          <Field label="Attendance date" htmlFor="attendance-date">
            <Input id="attendance-date" name="date" type="date" required defaultValue={board.date} />
          </Field>
          <button className="h-11 rounded-control border border-secondary/70 px-4 text-label-md text-on-surface hover:border-primary hover:text-primary" type="submit">
            View date
          </button>
        </form>
      </Card>

      {!readOnly && staffOptions.length > 0 && (
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Add a recurring shift" description={`This shift repeats every ${dayLabel}. Multiple shifts per day are supported.`} />
            <ActionForm action={addRecurringShiftAction} submitText="Add weekly shift" className="grid gap-4 sm:grid-cols-2">
              <Field label="Staff member" htmlFor="shift-staff">
                <Select id="shift-staff" name="staffId" required defaultValue="">
                  <option value="" disabled>Select staff</option>
                  {staffOptions.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </Select>
              </Field>
              <Field label="Weekday" htmlFor="shift-day">
                <Select id="shift-day" name="day" required defaultValue={String(board.day)}>
                  {WEEKDAY_LABELS.map((label, day) => <option key={label} value={day}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Shift starts" htmlFor="shift-start">
                <Input id="shift-start" name="start" type="time" required />
              </Field>
              <Field label="Shift ends" htmlFor="shift-end">
                <Input id="shift-end" name="end" type="time" required />
              </Field>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Record leave" description="Leave only applies between these dates. Attendance recorded on a leave date is shown as Present." />
            <ActionForm action={createLeaveAction} submitText="Record leave" className="grid gap-4 sm:grid-cols-2">
              <Field label="Staff member" htmlFor="leave-staff">
                <Select id="leave-staff" name="staffId" required defaultValue="">
                  <option value="" disabled>Select staff</option>
                  {staffOptions.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </Select>
              </Field>
              <Field label="Reason" htmlFor="leave-reason" hint="Optional">
                <Input id="leave-reason" name="reason" maxLength={300} placeholder="e.g. Personal leave" />
              </Field>
              <Field label="From" htmlFor="leave-from">
                <Input id="leave-from" name="fromDate" type="date" required defaultValue={board.date} />
              </Field>
              <Field label="Through" htmlFor="leave-to">
                <Input id="leave-to" name="toDate" type="date" required defaultValue={board.date} />
              </Field>
            </ActionForm>
          </Card>
        </div>
      )}

      {!readOnly && board.leaves.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Leave covering this date" description="Removing a leave record immediately updates attendance status for its date range." />
          <TableShell columns={["Staff", "Date range", "Reason", ""]}>
            {board.leaves.map((leave) => (
              <tr key={leave.id}>
                <td className="px-6 py-4 font-medium text-on-surface">{leave.staffName}</td>
                <td className="px-6 py-4 text-secondary">{leave.fromDate} – {leave.toDate}</td>
                <td className="px-6 py-4 text-secondary">{leave.reason ?? "—"}</td>
                <td className="px-6 py-4 text-right">
                  <ActionForm action={removeLeaveAction} submitText="Cancel leave" className="inline-flex items-center gap-2">
                    <input type="hidden" name="leaveId" value={leave.id} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-headline text-headline-sm font-semibold text-on-surface">Shift attendance</h2>
          <p className="mt-1 text-body-sm text-secondary">A shift is Present only after a manager records its clock-in. Leave is shown only within its dates; otherwise the shift stays Unmarked.</p>
        </div>
      </div>

      {board.staff.length ? (
        <div className="space-y-4">
          {board.staff.map((member) => <StaffAttendanceCard key={member.id} member={member} date={board.date} />)}
        </div>
      ) : (
        <Card className="text-center">
          <h3 className="font-semibold text-on-surface">{readOnly ? "Attendance needs a database" : "No active staff members"}</h3>
          <p className="mt-2 text-body-sm text-secondary">
            {readOnly
              ? "Set DATABASE_URL and run the database migrations to manage attendance."
              : "Add active staff profiles before setting shifts or recording attendance."}
          </p>
          {!readOnly && <ButtonLink href="/staff/new" className="mt-4" icon="plus">Add staff</ButtonLink>}
        </Card>
      )}
    </>
  );
}
