import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

// Actions read the session via getTenantContext and finish with redirect(); stub both at the framework edge.
type Role = "owner" | "manager" | "staff";
const ctx = vi.hoisted(() => ({ current: null as null | { tenantId: string; userId: string; role: Role; session: never } }));
vi.mock("@/server/shared/context", () => ({ getTenantContext: async () => ctx.current, requireTenantContext: async () => ctx.current }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

let actions: typeof import("@/server/customers/actions");
let queries: typeof import("@/server/customers/queries");
let tenantA: string;
let tenantB: string;

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const as = (tenantId: string | null, role: Role = "owner") => {
  ctx.current = tenantId ? { tenantId, userId: "u", role, session: {} as never } : null;
};
/** Run a server action that is expected to redirect on success; returns the target. */
async function redirected(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if ((error as { redirectTo?: string }).redirectTo) return (error as { redirectTo: string }).redirectTo;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeAll(async () => {
  const tenants = await import("@/server/tenants/service");
  actions = await import("@/server/customers/actions");
  queries = await import("@/server/customers/queries");
  const { id: templateId } = await tenants.createServiceTemplate({ name: "Haircut", category: "Hair", audience: "unisex", defaultDurationMinutes: 45, defaultPriceCents: 5_500 });
  const make = (slug: string) =>
    tenants.onboardTenant({
      tenant: { name: slug, slug, currency: "USD", timezone: "UTC" },
      owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
      branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [] },
      services: [{ templateId, priceCents: 1_000, durationMinutes: 30 }],
    });
  tenantA = await make("act-a");
  tenantB = await make("act-b");
});

beforeEach(() => as(tenantA));

describe("customer actions", () => {
  it("refuses callers without customers access", async () => {
    as(null);
    expect(await actions.createCustomerAction(undefined, form({ name: "Sophia Loren", phone: "5550100001" }))).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await actions.updateCustomerAction(undefined, form({ id: "x" }))).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("returns field errors without writing", async () => {
    const result = await actions.createCustomerAction(undefined, form({ name: "S", phone: "abc", email: "nope" }));
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { name: expect.any(Array), phone: expect.any(Array), email: expect.any(Array) } } });
    expect((await queries.getCustomerDirectory()).matching).toBe(0);
  });

  it("creates, redirects to the profile, then reports a duplicate phone as a field error", async () => {
    const to = await redirected(() => actions.createCustomerAction(undefined, form({ name: "Sophia Loren", phone: "+91 98450 12345", notes: "Hi" })));
    expect(to).toMatch(/^\/customers\/[0-9a-f-]{36}$/);
    expect(await queries.getCustomerProfile(to.split("/").pop()!)).toMatchObject({ name: "Sophia Loren", phone: "+919845012345", notes: "Hi" });

    const dup = await actions.createCustomerAction(undefined, form({ name: "Other Person", phone: "919845012345" }));
    expect(dup).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { phone: [expect.stringMatching(/already exists/)] } } });
  });

  it("updates through the action and rejects malformed or foreign ids", async () => {
    const to = await redirected(() => actions.createCustomerAction(undefined, form({ name: "Edit Me", phone: "5550100002" })));
    const id = to.split("/").pop()!;

    expect(await redirected(() => actions.updateCustomerAction(undefined, form({ id, name: "Edited", phone: "5550100002", gender: "other" })))).toBe(to);
    expect(await queries.getCustomerProfile(id)).toMatchObject({ name: "Edited", gender: "other" });

    expect(await actions.updateCustomerAction(undefined, form({ id: "not-a-uuid", name: "Edited", phone: "5550100002" }))).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    as(tenantB);
    expect(await actions.updateCustomerAction(undefined, form({ id, name: "Hijack", phone: "5550100077" }))).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    await expect(queries.getCustomerProfile(id)).rejects.toMatchObject({ notFound: true });
    await expect(queries.getCustomerProfile("not-a-uuid")).rejects.toMatchObject({ notFound: true });
  });
});
