import type { Metadata } from "next";
import { AttendanceManagement } from "@/components/views/attendance/attendance-management";
import { getAttendanceOverview } from "@/server/attendance/queries";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawDate = typeof params.date === "string" ? params.date : undefined;
  const { board, staffOptions } = await getAttendanceOverview(rawDate);
  return <AttendanceManagement board={board} staffOptions={staffOptions} />;
}
