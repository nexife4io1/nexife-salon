import { NextResponse } from "next/server";
import * as branchesService from "@/server/branches/service";
import { canManageBranches, canAccess } from "@/server/shared/rbac";
import { getSession } from "@/server/shared/session";

/** Branch overview endpoint for client-hydrated route sections. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.tid || !canAccess(session, "branches")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const overview = await branchesService.getOverview(session.tid);
    return NextResponse.json(
      {
        ...overview,
        canManage: canManageBranches(session.role),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load branches overview" }, { status: 500 });
  }
}
