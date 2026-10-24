import { z } from "zod";

// --- Normalisation ---------------------------------------------------------------------------------

/** Staff may type spaces, dashes or lower case; the stored form is upper case without them. */
export function normalizeRegistrationCode(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

/** Digits only, keeping a single leading "+": "+91 98765-43210" and "+919876543210" compare equal. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}

// --- Device login input ----------------------------------------------------------------------------

export const attendanceCredentialsSchema = z.object({
  salonCode: z.string().trim().toLowerCase().min(1, "Enter your salon code").max(64),
  registrationCode: z
    .string()
    .transform(normalizeRegistrationCode)
    .pipe(z.string().min(1, "Enter your registration code").max(32)),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your mobile number")
    .max(25)
    .transform(normalizePhone)
    .pipe(z.string().regex(/^\+?\d{6,15}$/, "Enter a valid mobile number")),
});
export type AttendanceCredentials = z.output<typeof attendanceCredentialsSchema>;

export const attendanceActionSchema = z.enum(["check_in", "check_out"]);
export type AttendanceActionKind = z.infer<typeof attendanceActionSchema>;

// --- Read models -----------------------------------------------------------------------------------

/** One attendance row. Times are ISO instants; `workDate` is the tenant-local calendar date. */
export type AttendanceRecord = {
  id: string;
  workDate: string;
  checkInAt: string;
  checkOutAt: string | null;
};

/** What the mobile page shows after a successful login. No ids: the server re-resolves every request. */
export type AttendanceSession = {
  staffName: string;
  branchName: string | null;
  salonName: string;
  timezone: string;
  today: string;
  record: AttendanceRecord | null;
};

export type AttendanceLoginState =
  | { ok: true; session: AttendanceSession }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | undefined;
