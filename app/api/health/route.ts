import { NextResponse } from "next/server";

/** Liveness probe for deploys / uptime checks. TODO(phase 6): add a DB ping for readiness. */
export function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
