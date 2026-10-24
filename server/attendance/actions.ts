"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { validationError } from "@/server/shared/errors";
import { toActionError } from "@/server/shared/result";
import { attendanceActionSchema, attendanceCredentialsSchema, type AttendanceLoginState } from "./schema";
import * as service from "./service";

/** Best-effort caller identity for throttling; behind a trusted proxy the first forwarded hop is the client. */
async function callerId(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

function failure(error: unknown): AttendanceLoginState {
  const result = toActionError(error);
  if (result.ok) throw new Error("unreachable");
  return { ok: false, error: result.error.message, fieldErrors: result.error.fieldErrors };
}

function readCredentials(formData: FormData) {
  return attendanceCredentialsSchema.safeParse({
    salonCode: formData.get("salonCode"),
    registrationCode: formData.get("registrationCode"),
    phone: formData.get("phone"),
  });
}

/** Public (no session): verify the three credentials and report today's attendance. */
export async function attendanceLoginAction(_prev: AttendanceLoginState, formData: FormData): Promise<AttendanceLoginState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return failure(validationError(parsed.error));
  try {
    return { ok: true, session: await service.login(parsed.data, await callerId()) };
  } catch (error) {
    return failure(error);
  }
}

/** Public (no session): re-authenticates with the credentials on every call, then records attendance. */
export async function markAttendanceAction(_prev: AttendanceLoginState, formData: FormData): Promise<AttendanceLoginState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return failure(validationError(parsed.error));
  const kind = attendanceActionSchema.safeParse(formData.get("kind"));
  if (!kind.success) return failure(validationError(kind.error));
  try {
    const session = await service.mark(parsed.data, kind.data, await callerId());
    revalidatePath("/staff", "layout"); // staff profiles list attendance
    return { ok: true, session };
  } catch (error) {
    return failure(error);
  }
}
