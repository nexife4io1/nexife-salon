import "server-only";
import { requireTenantContext } from "@/server/shared/context";

/** Guards the assistant page; returns what the UI needs to greet the user. */
export async function getAssistantContext() {
  const ctx = await requireTenantContext("assistant");
  return { userName: ctx.session.name };
}
