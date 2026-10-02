/**
 * Core salon schema (Supabase Postgres, `salon` schema).
 *
 * Assistant data is intentionally NOT modelled here: the assistant keeps its
 * own data access in server/assistant/repository.ts. When RAG embeddings move
 * to pgvector (roadmap step 11) they get their own schema file + Postgres schema.
 */
export * from "./tenancy";
export * from "./operations";
export * from "./ledger";
export * from "./inventory";
