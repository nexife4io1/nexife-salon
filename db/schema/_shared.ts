import { pgSchema, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * All core salon tables live in the `salon` Postgres schema so they stay
 * separate from the assistant's demo sales data (public schema) in the same
 * Supabase project.
 */
export const salon = pgSchema("salon");

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
