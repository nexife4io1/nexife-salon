"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { ok, toActionError, type ActionResult } from "@/server/shared/result";
import {
  addShiftSchema,
  createLeaveSchema,
  recordAttendanceSchema,
  removeLeaveSchema,
  removeShiftSchema,
} from "./schema";
import * as service from "./service";

const FORBIDDEN = "You don't have access to manage attendance.";

async function runAction(
  menu: "attendance",
  operation: (ctx: NonNullable<Awaited<ReturnType<typeof getTenantContext>>>) => Promise<void>,
): Promise<ActionResult> {
  const ctx = await getTenantContext(menu);
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));
  try {
    await operation(ctx);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/attendance");
  revalidatePath("/staff");
  return ok(undefined);
}

export async function addRecurringShiftAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = addShiftSchema.safeParse({
    staffId: formData.get("staffId"),
    day: formData.get("day"),
    start: formData.get("start"),
    end: formData.get("end"),
  });
  if (!parsed.success) return toActionError(validationError(parsed.error));
  return runAction("attendance", (ctx) => service.addRecurringShift(ctx, parsed.data));
}

export async function removeRecurringShiftAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = removeShiftSchema.safeParse({ shiftId: formData.get("shiftId") });
  if (!parsed.success) return toActionError(validationError(parsed.error));
  return runAction("attendance", (ctx) => service.removeRecurringShift(ctx, parsed.data.shiftId));
}

export async function recordAttendanceAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = recordAttendanceSchema.safeParse({
    staffId: formData.get("staffId"),
    shiftId: formData.get("shiftId"),
    workDate: formData.get("workDate"),
    clockIn: formData.get("clockIn"),
    clockOut: formData.get("clockOut"),
    note: formData.get("note"),
  });
  if (!parsed.success) return toActionError(validationError(parsed.error));
  return runAction("attendance", (ctx) => service.recordAttendance(ctx, parsed.data));
}

export async function createLeaveAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = createLeaveSchema.safeParse({
    staffId: formData.get("staffId"),
    fromDate: formData.get("fromDate"),
    toDate: formData.get("toDate"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return toActionError(validationError(parsed.error));
  return runAction("attendance", (ctx) => service.createLeave(ctx, parsed.data));
}

export async function removeLeaveAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = removeLeaveSchema.safeParse({ leaveId: formData.get("leaveId") });
  if (!parsed.success) return toActionError(validationError(parsed.error));
  return runAction("attendance", (ctx) => service.removeLeave(ctx, parsed.data.leaveId));
}
