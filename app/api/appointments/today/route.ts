import { NextResponse } from "next/server";
import * as appointmentsService from "@/server/appointments/service";
import { canAccess } from "@/server/shared/rbac";
import { getSession } from "@/server/shared/session";

/** Appointments list endpoint for client-hydrated route sections. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.tid || !canAccess(session, "appointments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const appointments = await appointmentsService.listToday(session.tid);
    return NextResponse.json(
      appointments.map((appointment) => ({
        ...appointment,
        startsAt: appointment.startsAt.toISOString(),
      })),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load appointments" }, { status: 500 });
  }
}
