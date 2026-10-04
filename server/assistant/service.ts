import "server-only";
import type { ChatReply, ChatRequest } from "./schema";

/**
 * Assistant engine entry point. Placeholder until the POC engine is ported.
 *
 * Extension points (roadmap step 11):
 *   - streamReply(): return a ReadableStream for token streaming from the
 *     same route handler (no separate service needed).
 *   - Run tools from ./tools with the caller's tenant id.
 */
export async function reply(request: ChatRequest, ctx: { tenantId: string; userName: string }): Promise<ChatReply> {
  const last = request.messages.at(-1)!;
  return {
    live: false,
    message: {
      role: "assistant",
      content: `Hi ${ctx.userName.split(" ")[0]} — Style Studio isn't connected to a model yet. Once it is, I'll answer “${last.content.slice(0, 80)}” using your salon's live data.`,
    },
  };
}
