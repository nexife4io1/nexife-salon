import "server-only";

/**
 * Assistant data access — deliberately separate from the core salon schema.
 *
 * In the POC this was lib/assistant/supabase.ts (demo sales data queried by the
 * search_products / get_customer_orders / get_sales_summary tools). When the
 * assistant is ported (roadmap step 11) that client moves here, and
 * uploaded-document embeddings move from MemoryVectorStore to pgvector.
 *
 * No dependency is added until then.
 */
export const assistantRepository = {
  // TODO(step 11): searchProducts(), getCustomerOrders(), getSalesSummary(), upsertEmbeddings().
} as const;
