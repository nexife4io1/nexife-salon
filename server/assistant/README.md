# server/assistant

The embedded AI assistant ("Style Studio") lives inside the monolith.

| File            | Role                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `schema.ts`     | Zod contracts for chat requests/replies                              |
| `service.ts`    | Engine entry point (placeholder reply today)                         |
| `tools.ts`      | Tool registry; tools call **domain services**, never repositories    |
| `repository.ts` | Assistant-only data (demo sales DB, future pgvector embeddings)      |

Entry point from the UI: `app/api/assistant/chat/route.ts` (POST).

## Porting the POC (roadmap step 11)

The POC's `lib/assistant/*` (LangChain + OpenAI, `supabase.ts`, document loaders)
was not in this repository when the skeleton was created. When it is ported:

1. `lib/assistant/supabase.ts` → `repository.ts`
2. engine / agent setup → `service.ts`; add `streamReply()` and stream from the same route
3. tools → `tools.ts`, rewritten to call domain services with `ctx.tenantId`
4. `MemoryVectorStore` → pgvector table in its own Postgres schema
5. image generation + bulk ingestion → background jobs (Inngest / Trigger.dev, step 12)

Add `langchain`, `@langchain/openai` etc. only at that point.
