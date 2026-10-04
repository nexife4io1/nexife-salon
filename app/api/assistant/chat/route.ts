import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/server/assistant/schema";
import { reply } from "@/server/assistant/service";
import { canAccess } from "@/server/shared/rbac";
import { getSession } from "@/server/shared/session";

/** Thin route handler: authn/RBAC + validation, then delegate to the assistant service. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.tid || !canAccess(session, "assistant")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  // TODO(step 11): return a streamed Response from service.streamReply().
  const result = await reply(parsed.data, { tenantId: session.tid, userName: session.name });
  return NextResponse.json(result);
}
