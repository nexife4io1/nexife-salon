import type { Metadata } from "next";
import { AttendanceDevice } from "@/components/views/attendance/attendance-device";
import { attendanceLoginAction, markAttendanceAction } from "@/server/attendance/actions";

export const metadata: Metadata = { title: "Staff attendance" };

/** Standalone, mobile-first page (outside the authenticated app shell). */
export default function AttendancePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <span className="mb-8 block font-headline text-headline-md font-bold text-primary">Nexife</span>
      <h1 className="font-headline text-headline-lg text-on-surface">Staff attendance</h1>
      <p className="mt-2 mb-8 text-body-md text-secondary">Sign in with your registration code and mobile number.</p>
      <AttendanceDevice loginAction={attendanceLoginAction} markAction={markAttendanceAction} />
    </main>
  );
}
