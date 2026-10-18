import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// PGlite-backed: customers.service -> repository -> real SQL with every migration applied.
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

let tenants: typeof import("@/server/tenants/service");
let customers: typeof import("@/server/customers/service");
let schema: typeof import("@/server/customers/schema");
let tables: typeof import("@/db/schema");
let db: ReturnType<typeof import("@/db/client").getDb>;

let templateId = "";

async function newTenant(slug: string) {
  return tenants.onboardTenant({
    tenant: { name: slug, slug, currency: "USD", timezone: "UTC" },
    owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
    branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [] },
    services: [{ templateId, priceCents: 1_000, durationMinutes: 30 }],
  });
}

const input = (raw: Record<string, unknown>) => schema.customerInputSchema.parse({ name: "Sophia Loren", phone: "+91 98450 12345", ...raw });
const NO_FILTERS: import("@/server/customers/schema").CustomerFilters = { sort: "name", page: 1 };

beforeAll(async () => {
  tenants = await import("@/server/tenants/service");
  customers = await import("@/server/customers/service");
  schema = await import("@/server/customers/schema");
  tables = await import("@/db/schema");
  db = (await import("@/db/client")).getDb();
  templateId = (await tenants.createServiceTemplate({ name: "Haircut", category: "Hair", audience: "unisex", defaultDurationMinutes: 45, defaultPriceCents: 5_500 })).id;
});

describe("customers: create and read", () => {
  it("persists every field with a normalized phone and reads it back", async () => {
    const t = await newTenant("full");
    const { id } = await customers.createCustomer(
      t,
      input({ email: "Sophia@Example.com", birthday: "1990-02-28", gender: "female", notes: "Prefers Elena" }),
    );
    const profile = await customers.getProfile(t, id);
    expect(profile).toMatchObject({
      id,
      name: "Sophia Loren",
      phone: "+919845012345",
      email: "sophia@example.com",
      birthday: "1990-02-28",
      gender: "female",
      notes: "Prefers Elena",
      visitCount: 0,
    });
    expect(Number.isNaN(Date.parse(profile.createdAt))).toBe(false);
  });

  it("stores optional fields as null", async () => {
    const t = await newTenant("minimal");
    const { id } = await customers.createCustomer(t, input({}));
    expect(await customers.getProfile(t, id)).toMatchObject({ email: null, birthday: null, gender: null, notes: null });
  });
});

describe("customers: tenant isolation", () => {
  it("never returns another tenant's customer, in the profile, the list or search", async () => {
    const a = await newTenant("iso-a");
    const b = await newTenant("iso-b");
    const { id } = await customers.createCustomer(a, input({ name: "Only In A" }));

    await expect(customers.getProfile(b, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await customers.getDirectory(b, NO_FILTERS)).customers).toEqual([]);
    expect(await customers.searchCustomers(b, { q: "Only" })).toEqual([]);
    expect((await customers.getDirectory(a, NO_FILTERS)).customers.map((c) => c.id)).toEqual([id]);
  });

  it("cannot update another tenant's customer", async () => {
    const a = await newTenant("upd-a");
    const b = await newTenant("upd-b");
    const { id } = await customers.createCustomer(a, input({ name: "Mine" }));

    await expect(customers.updateCustomer(b, id, input({ name: "Hijacked", phone: "5550109999" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await customers.getProfile(a, id)).name).toBe("Mine");
  });

  it("reports a missing customer as NOT_FOUND", async () => {
    const t = await newTenant("missing");
    await expect(customers.getProfile(t, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(customers.updateCustomer(t, "00000000-0000-4000-8000-000000000000", input({}))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("customers: phone de-duplication", () => {
  it("rejects the same number in a different format, with a field error, and creates no row", async () => {
    const t = await newTenant("dup");
    await customers.createCustomer(t, input({ phone: "+91 98450 12345" }));

    await expect(customers.createCustomer(t, input({ name: "Someone Else", phone: "+91-98450-12345" }))).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { phone: [expect.stringMatching(/already exists/)] },
    });
    expect((await customers.getDirectory(t, NO_FILTERS)).matching).toBe(1);
  });

  it("allows the same number in another tenant", async () => {
    const a = await newTenant("dup-a");
    const b = await newTenant("dup-b");
    await customers.createCustomer(a, input({}));
    await expect(customers.createCustomer(b, input({}))).resolves.toHaveProperty("id");
  });

  it("lets a customer keep their own number on edit but not take another's", async () => {
    const t = await newTenant("dup-edit");
    const first = await customers.createCustomer(t, input({ name: "First", phone: "5550100001" }));
    const second = await customers.createCustomer(t, input({ name: "Second", phone: "5550100002" }));

    await expect(customers.updateCustomer(t, first.id, input({ name: "First Renamed", phone: "555-010-0001" }))).resolves.toEqual(first);
    await expect(customers.updateCustomer(t, second.id, input({ name: "Second", phone: "555 010 0001" }))).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { phone: expect.any(Array) },
    });
    expect(await customers.getProfile(t, second.id)).toMatchObject({ phone: "5550100002" });

    await customers.updateCustomer(t, second.id, input({ name: "Second", phone: "5550100003", notes: "moved" }));
    expect(await customers.getProfile(t, second.id)).toMatchObject({ phone: "5550100003", notes: "moved" });
    // The old number is free again.
    await expect(customers.createCustomer(t, input({ name: "Third", phone: "5550100002" }))).resolves.toHaveProperty("id");
  });

  it("is backed by a unique index, so a concurrent insert cannot slip through", async () => {
    const t = await newTenant("dup-index");
    await customers.createCustomer(t, input({ phone: "5550100009" }));
    await expect(db.insert(tables.customers).values({ tenantId: t, name: "Raw", phone: "5550100009", phoneKey: "5550100009" })).rejects.toThrow();
  });
});

describe("customers: directory", () => {
  it("searches name, email and phone digits, escaping wildcards", async () => {
    const t = await newTenant("search");
    await customers.createCustomer(t, input({ name: "Ava Martinez", phone: "+91 99789 01234", email: "ava@example.com" }));
    await customers.createCustomer(t, input({ name: "100% Real", phone: "5550100001" }));
    await customers.createCustomer(t, input({ name: "Olivia Chen", phone: "5550100002" }));

    const names = async (q: string) => (await customers.getDirectory(t, { ...NO_FILTERS, q })).customers.map((c) => c.name);
    expect(await names("martin")).toEqual(["Ava Martinez"]);
    expect(await names("AVA@EXAMPLE")).toEqual(["Ava Martinez"]);
    expect(await names("99789 01")).toEqual(["Ava Martinez"]);
    expect(await names("% Real")).toEqual(["100% Real"]);
    expect(await names("%")).toEqual(["100% Real"]);
    expect(await names("zzz")).toEqual([]);
    expect((await customers.getDirectory(t, { ...NO_FILTERS, q: "zzz" })).filtered).toBe(true);
  });

  it("paginates, clamps stale pages and sorts", async () => {
    const t = await newTenant("pages");
    for (let i = 0; i < 25; i++) {
      await customers.createCustomer(t, input({ name: `Customer ${String(i).padStart(2, "0")}`, phone: `55501000${String(i).padStart(2, "0")}` }));
    }

    const first = await customers.getDirectory(t, NO_FILTERS);
    expect(first).toMatchObject({ matching: 25, page: 1, pageCount: 2, pageSize: 20 });
    expect(first.customers).toHaveLength(20);
    expect(first.customers[0]?.name).toBe("Customer 00");

    const second = await customers.getDirectory(t, { ...NO_FILTERS, page: 2 });
    expect(second.customers.map((c) => c.name)).toEqual(["Customer 20", "Customer 21", "Customer 22", "Customer 23", "Customer 24"]);

    const stale = await customers.getDirectory(t, { ...NO_FILTERS, page: 9 });
    expect(stale.page).toBe(2);
    expect(stale.customers).toHaveLength(5);

    await db.update(tables.customers).set({ visitCount: 7 }).where(eq(tables.customers.name, "Customer 13"));
    const byVisits = await customers.getDirectory(t, { ...NO_FILTERS, sort: "visits" });
    expect(byVisits.customers[0]?.name).toBe("Customer 13");
  });

  it("computes stats from stored data only", async () => {
    const t = await newTenant("stats");
    const a = await customers.createCustomer(t, input({ name: "Visited Often", phone: "5550100001" }));
    await customers.createCustomer(t, input({ name: "Brand New", phone: "5550100002" }));
    const old = await customers.createCustomer(t, input({ name: "Long Ago", phone: "5550100003" }));
    await db.update(tables.customers).set({ visitCount: 5 }).where(eq(tables.customers.id, a.id));
    await db.update(tables.customers).set({ createdAt: new Date("2020-01-15T00:00:00Z"), visitCount: 1 }).where(eq(tables.customers.id, old.id));

    const { stats } = await customers.getDirectory(t, NO_FILTERS, new Date());
    expect(stats).toEqual({ total: 3, newThisMonth: 2, returning: 1 });
    expect((await customers.getDirectory(t, NO_FILTERS, new Date("2100-01-20T00:00:00Z"))).stats.newThisMonth).toBe(0);
  });
});
