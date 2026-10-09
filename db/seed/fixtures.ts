/**
 * Demo fixtures — the single source of demo data.
 *
 * Used in two places:
 *   1. `npm run db:seed` inserts these rows into Postgres.
 *   2. When DATABASE_URL is unset, repositories read them (read-only) so the
 *      app runs on a laptop without a database.
 *
 * This is NOT an in-memory store: nothing here is ever mutated at runtime.
 * Writes require a configured database.
 *
 * Tenants mirror the POC (Meridian Salon, Bro Barber); branches mirror the
 * Branches mockup (Materials/code.html).
 */

export type FixtureRole = "platform_admin" | "owner" | "manager" | "staff";

export const fixtureTenants = [
  { id: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01", slug: "meridian", name: "Meridian Salon", currency: "USD", timezone: "America/Los_Angeles" },
  { id: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02", slug: "bro-barber", name: "Bro Barber", currency: "USD", timezone: "America/Los_Angeles" },
] as const;

const [meridian, broBarber] = fixtureTenants;

export const fixtureBranches = [
  { id: "b1a7e0c4-5f21-4c8e-8d3a-000000000001", tenantId: meridian.id, name: "Downtown Flagship", addressLine: "124 Main St, City Center", city: "Los Angeles", status: "active" },
  { id: "b1a7e0c4-5f21-4c8e-8d3a-000000000002", tenantId: meridian.id, name: "Beverly Hills Studio", addressLine: "450 Rodeo Drive", city: "Beverly Hills", status: "active" },
  { id: "b1a7e0c4-5f21-4c8e-8d3a-000000000003", tenantId: meridian.id, name: "West Hollywood", addressLine: "8900 Melrose Ave", city: "West Hollywood", status: "active" },
  { id: "b1a7e0c4-5f21-4c8e-8d3a-000000000004", tenantId: broBarber.id, name: "Bro Barber — Arts District", addressLine: "710 Traction Ave", city: "Los Angeles", status: "active" },
] as const;

/**
 * Today's activity per branch, shown on the Branches page in fixture mode.
 * In database mode these numbers are computed from staff / appointments /
 * payments rows instead.
 */
export const fixtureBranchActivity: Record<string, { staffCount: number; appointmentsToday: number; revenueTodayCents: number }> = {
  [fixtureBranches[0].id]: { staffCount: 12, appointmentsToday: 24, revenueTodayCents: 428_000 },
  [fixtureBranches[1].id]: { staffCount: 8, appointmentsToday: 18, revenueTodayCents: 612_000 },
  [fixtureBranches[2].id]: { staffCount: 15, appointmentsToday: 32, revenueTodayCents: 589_000 },
  [fixtureBranches[3].id]: { staffCount: 4, appointmentsToday: 11, revenueTodayCents: 96_000 },
};

/** Passwords are NOT stored here; every demo user uses DEMO_PASSWORD (hashed on use). */
export const fixtureUsers: ReadonlyArray<{
  id: string;
  tenantId: string | null;
  name: string;
  username: string;
  role: FixtureRole;
}> = [
  { id: "a0e4d8f2-0000-4000-8000-000000000001", tenantId: null, name: "Nexife Admin", username: "admin", role: "platform_admin" },
  { id: "a0e4d8f2-0000-4000-8000-000000000002", tenantId: meridian.id, name: "Sarah Jenkins", username: "sarah", role: "owner" },
  { id: "a0e4d8f2-0000-4000-8000-000000000003", tenantId: meridian.id, name: "Maya Ortiz", username: "maya", role: "manager" },
  { id: "a0e4d8f2-0000-4000-8000-000000000004", tenantId: broBarber.id, name: "Dev Kapoor", username: "dev", role: "owner" },
];

export const fixtureServices = [
  { tenantId: meridian.id, name: "Signature Cut & Style", audience: "women" as const, category: "Hair", durationMinutes: 60, priceCents: 9_500 },
  { tenantId: meridian.id, name: "Balayage", audience: "women" as const, category: "Color", durationMinutes: 150, priceCents: 28_000 },
  { tenantId: meridian.id, name: "Gloss Treatment", audience: "unisex" as const, category: "Care", durationMinutes: 45, priceCents: 6_500 },
  { tenantId: broBarber.id, name: "Classic Fade", audience: "men" as const, category: "Hair", durationMinutes: 30, priceCents: 3_500 },
  { tenantId: broBarber.id, name: "Beard Sculpt", audience: "men" as const, category: "Grooming", durationMinutes: 20, priceCents: 2_000 },
] as const;

/** Fixed creation date for fixture tenants (the tenants rows themselves get `now()` when seeded). */
export const fixtureTenantCreatedAt = "2026-01-12T09:00:00.000Z";

/** Platform-level service catalog that tenant admins pick from when onboarding. */
export const fixtureServiceTemplates = [
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000001", name: "Haircut", audience: "unisex" as const, category: "Hair", defaultDurationMinutes: 45, defaultPriceCents: 5_500 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000002", name: "Blow Dry & Style", audience: "women" as const, category: "Hair", defaultDurationMinutes: 30, defaultPriceCents: 4_000 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000003", name: "Full Colour", audience: "women" as const, category: "Color", defaultDurationMinutes: 120, defaultPriceCents: 14_000 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000004", name: "Highlights", audience: "women" as const, category: "Color", defaultDurationMinutes: 150, defaultPriceCents: 18_000 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000005", name: "Beard Trim", audience: "men" as const, category: "Grooming", defaultDurationMinutes: 20, defaultPriceCents: 2_000 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000006", name: "Manicure", audience: "women" as const, category: "Nails", defaultDurationMinutes: 40, defaultPriceCents: 3_500 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000007", name: "Facial", audience: "unisex" as const, category: "Skin", defaultDurationMinutes: 60, defaultPriceCents: 8_000 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000009", name: "Kids Haircut", audience: "kids" as const, category: "Hair", defaultDurationMinutes: 30, defaultPriceCents: 3_000 },
  { id: "c7e1a5d0-3b2f-4a6e-9c1d-000000000008", name: "Deep Conditioning Treatment", audience: "unisex" as const, category: "Care", defaultDurationMinutes: 30, defaultPriceCents: 4_500 },
] as const;

export const DEFAULT_DEMO_PASSWORD = "nexife-demo";

export function demoPassword(): string {
  return process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
}
