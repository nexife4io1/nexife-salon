import "server-only";

/**
 * Tool registry extension point for the assistant.
 *
 * Tools that read salon data MUST call domain services (e.g. appointments,
 * billing) with the caller's tenant id — never repositories or the DB client.
 */
export type AssistantTool = {
  name: string;
  description: string;
  run: (args: unknown, ctx: { tenantId: string }) => Promise<unknown>;
};

export const assistantTools: AssistantTool[] = [
  // TODO(step 11): port POC tools; heavy ones (image generation, bulk ingestion)
  // go to background jobs (roadmap step 12) instead of running inline.
];
