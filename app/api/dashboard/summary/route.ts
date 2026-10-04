import { NextResponse } from "next/server";
import * as dashboardService from "@/server/dashboard/service";
import { canAccess } from "@/server/shared/rbac";
import { getSession } from "@/server/shared/session";

/** Dashboard summary endpoint for client-hydrated route sections. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.tid || !canAccess(session, "dashboard")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await dashboardService.getSummary(session.tid);
    return NextResponse.json(
      { ...summary, userName: session.name },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load dashboard summary" }, { status: 500 });
  }
}
