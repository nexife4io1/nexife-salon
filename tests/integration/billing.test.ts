import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// PGlite-backed: appointments + billing services -> real SQL with every migration applied.
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

type TenantContext = import("@/server/shared/context").TenantContext;
type BookInput = import("@/server/appointments/schema").BookAppointmentInput;
type PayInput = import("@/server/billing/schema").RecordPaymentInput;
let tenants: typeof import("@/server/tenants/service");
let staff: typeof import("@/server/staff/service");
let appts: typeof import("@/server/appointments/service");
let apptSchema: typeof import("@/server/appointments/schema");
let billing: typeof import("@/server/billing/service");
let billingSchema: typeof import("@/server/billing/schema");
let staffSchema: typeof import("@/server/staff/schema");
let tables: typeof import("@/db/schema");
let db: ReturnType<typeof import("@/db/client").getDb>;

const ctxFor = (tenantId: string): TenantContext => ({ tenantId, userId: "u", role: "owner", session: {} as never });
const NOW = new Date("2026-10-16T08:00:00Z");
const templates: { id: string; name: string; minutes: number; price: number }[] = [];

type T = Awaited<ReturnType<typeof newTenant>>;

async function newTenant(slug: string) {
  const id = await tenants.onboardTenant({
    tenant: { name: slug, slug, currency: "USD", timezone: "UTC" },
    owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
    // Haircut + Color are offered by the branch; Perm exists in the catalog but is not offered.
    branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [templates[0]!.id, templates[1]!.id] },
    services: templates.map((t) => ({ templateId: t.id, priceCents: t.price, durationMinutes: t.minutes })),
  });
  const [branch] = await db.select().from(tables.branches).where(eq(tables.branches.tenantId, id));
  const services = await db.select().from(tables.services).where(eq(tables.services.tenantId, id));
  const byName = (name: string) => services.find((s) => s.name === name)!.id;
  const [customer] = await db.insert(tables.customers).values({ tenantId: id, name: "Cara Customer" }).returning();
  const member = (await staff.createStaff(ctxFor(id), staffSchema.staffInputSchema.parse({ name: "Sam Stylist", branchId: branch!.id }))).id;
  return { id, ctx: ctxFor(id), branchId: branch!.id, haircut: byName("Haircut"), color: byName("Color"), perm: byName("Perm"), customerId: customer!.id, member };
}

const book = (t: T, over: Partial<Record<keyof BookInput, string | string[]>> = {}) =>
  appts.book(
    t.ctx,
    apptSchema.bookAppointmentInputSchema.parse({ branchId: t.branchId, serviceId: [t.haircut, t.color], customerId: t.customerId, staffId: t.member, date: "2026-10-20", time: "10:00", ...over }),
    NOW,
  );

/** Book, then walk the appointment through to "completed" (service done, payment still open). */
async function completedAppointment(t: T, over: Partial<Record<keyof BookInput, string | string[]>> = {}) {
  const { id } = await book(t, over);
  for (const status of ["checked_in", "in_service", "completed"] as const) await appts.changeStatus(t.ctx, { id, status });
  return id;
}

const pay = (t: T, appointmentId: string, over: Partial<PayInput> = {}) =>
  billing.recordPayment(
    t.ctx,
    billingSchema.recordPaymentInputSchema.parse({
      appointmentId,
      lines: [
        { kind: "catalog", serviceId: t.haircut },
        { kind: "catalog", serviceId: t.color },
      ],
      payments: [{ method: "cash", amountCents: 12_000 }], // haircut 4,000 + color 8,000
      ...over,
    }),
    new Date("2026-10-20T11:00:00Z"),
  );

beforeAll(async () => {
  tenants = await import("@/server/tenants/service");
  staff = await import("@/server/staff/service");
  appts = await import("@/server/appointments/service");
  apptSchema = await import("@/server/appointments/schema");
  billing = await import("@/server/billing/service");
  billingSchema = await import("@/server/billing/schema");
  staffSchema = await import("@/server/staff/schema");
  tables = await import("@/db/schema");
  db = (await import("@/db/client")).getDb();
  for (const [name, minutes, price] of [["Haircut", 30, 4_000], ["Color", 90, 8_000], ["Perm", 60, 6_000]] as const) {
    const tpl = await tenants.createServiceTemplate({ name, category: "Hair", audience: "unisex", defaultDurationMinutes: minutes, defaultPriceCents: price });
    templates.push({ id: tpl.id, name, minutes, price });
  }
});

describe("booking several services", () => {
  it("snapshots every service and books the combined duration and price", async () => {
    const t = await newTenant("multi");
    const { id } = await book(t);
    const [appointment] = (await appts.listForCustomer(t.id, t.customerId)).filter((a) => a.id === id);
    expect(appointment).toMatchObject({ serviceName: "Haircut, Color", durationMinutes: 120, totalCents: 12_000, serviceId: t.haircut });
    expect(appointment!.services.map((s) => [s.name, s.priceCents, s.durationMinutes])).toEqual([["Haircut", 4_000, 30], ["Color", 8_000, 90]]);
    expect(appointment!.endsAt.toISOString()).toBe("2026-10-20T12:00:00.000Z");
  });

  it("holds the stylist for the whole combined duration", async () => {
    const t = await newTenant("multi-conflict");
    await book(t); // 10:00-12:00
    await expect(book(t, { time: "11:30", serviceId: t.haircut })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(book(t, { time: "12:00", serviceId: t.haircut })).resolves.toBeTruthy();
  });

  it("rejects services the branch does not offer, and duplicates", async () => {
    const t = await newTenant("multi-invalid");
    await expect(book(t, { serviceId: [t.haircut, t.perm] })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { serviceId: [expect.stringContaining("Perm")] } });
    expect(apptSchema.bookAppointmentInputSchema.safeParse({ branchId: t.branchId, serviceId: [t.haircut, t.haircut], type: "walk_in" }).success).toBe(false);
    expect(apptSchema.bookAppointmentInputSchema.safeParse({ branchId: t.branchId, serviceId: [], type: "walk_in" }).success).toBe(false);
  });

  it("keeps the booked price when the catalog price changes later", async () => {
    const t = await newTenant("multi-snapshot");
    const id = await completedAppointment(t);
    await tenants.updateTenantService({ tenantId: t.id, serviceId: t.haircut, priceCents: 9_999, durationMinutes: 30, active: true });
    const checkout = await billing.getCheckout(t.ctx, id);
    expect(checkout.lines.map((l) => [l.name, l.priceCents])).toEqual([["Haircut", 4_000], ["Color", 8_000]]);
  });
});

describe("checkout", () => {
  it("prepopulates every booked service and is not payable until the service is completed", async () => {
    const t = await newTenant("co-ready");
    const { id } = await book(t);
    expect((await billing.getCheckout(t.ctx, id)).state).toBe("not_ready");
    await expect(pay(t, id)).rejects.toMatchObject({ code: "CONFLICT" });

    for (const status of ["checked_in", "in_service", "completed"] as const) await appts.changeStatus(t.ctx, { id, status });
    const view = await billing.getCheckout(t.ctx, id);
    expect(view).toMatchObject({ state: "ready", receiptId: null, currency: "USD" });
    expect(view.lines.map((l) => l.name)).toEqual(["Haircut", "Color"]);
    expect(view.catalog.map((s) => s.name).sort()).toEqual(["Color", "Haircut"]); // Perm isn't offered here
  });

  it("completing the service never records a payment: the appointment stays payable", async () => {
    const t = await newTenant("co-unpaid");
    const id = await completedAppointment(t);
    expect(await db.select().from(tables.payments).where(eq(tables.payments.tenantId, t.id))).toHaveLength(0);
    expect(await db.select().from(tables.invoices).where(eq(tables.invoices.tenantId, t.id))).toHaveLength(0);

    const overview = await billing.getOverview(t.id, new Date("2026-10-20T12:00:00Z"));
    expect(overview.openTickets.map((o) => [o.appointmentId, o.totalCents])).toEqual([[id, 12_000]]);
    expect(overview.revenueTodayCents).toBe(0);

    await pay(t, id);
    expect((await billing.getOverview(t.id, new Date("2026-10-20T12:00:00Z"))).openTickets).toHaveLength(0);
  });

  it("lets staff remove booked services, add catalog services and one-off items", async () => {
    const t = await newTenant("co-edit");
    const id = await completedAppointment(t, { serviceId: t.haircut });
    const { invoiceId } = await pay(t, id, {
      lines: [{ kind: "catalog", serviceId: t.color }, { kind: "custom", name: "  Scalp oil  ", priceCents: 1_550 }],
      payments: [{ method: "card", amountCents: 9_550 }],
    });
    const receipt = await billing.getReceipt(t.ctx, invoiceId);
    expect(receipt.lines.map((l) => [l.name, l.amountCents])).toEqual([["Color", 8_000], ["Scalp oil", 1_550]]);
    expect(receipt.totalCents).toBe(9_550);
    // The one-off item never touches the shared catalog.
    expect((await db.select().from(tables.services).where(eq(tables.services.tenantId, t.id))).map((s) => s.name).sort()).toEqual(["Color", "Haircut", "Perm"]);
    const [line] = await db.select().from(tables.invoiceLines).where(and(eq(tables.invoiceLines.invoiceId, invoiceId), eq(tables.invoiceLines.kind, "custom")));
    expect(line).toMatchObject({ name: "Scalp oil", serviceId: null, amountCents: 1_550 });
  });

  it("prices services added at checkout from the catalog, only if the branch offers them", async () => {
    const t = await newTenant("co-catalog");
    const id = await completedAppointment(t, { serviceId: t.haircut });
    await expect(pay(t, id, { lines: [{ kind: "catalog", serviceId: t.perm }], payments: [{ method: "cash", amountCents: 6_000 }] })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { lines: [expect.stringContaining("isn't available")] },
    });
    const { invoiceId } = await pay(t, id, { lines: [{ kind: "catalog", serviceId: t.haircut }, { kind: "catalog", serviceId: t.color }], payments: [{ method: "cash", amountCents: 12_000 }] });
    expect((await billing.getReceipt(t.ctx, invoiceId)).totalCents).toBe(12_000);
  });
});

describe("payment amounts", () => {
  it("requires payments to add up to the server-computed total exactly", async () => {
    const t = await newTenant("amt");
    const id = await completedAppointment(t);
    for (const amountCents of [11_999, 12_001, 1]) {
      await expect(pay(t, id, { payments: [{ method: "cash", amountCents }] })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { payments: [expect.stringContaining("bill is $120")] } });
    }
    expect(await db.select().from(tables.invoices).where(eq(tables.invoices.tenantId, t.id))).toHaveLength(0);
    expect(await db.select().from(tables.payments).where(eq(tables.payments.tenantId, t.id))).toHaveLength(0);
  });

  it("rejects duplicate services and a zero total", async () => {
    const t = await newTenant("amt-lines");
    const id = await completedAppointment(t);
    await expect(
      pay(t, id, { lines: [{ kind: "catalog", serviceId: t.haircut }, { kind: "catalog", serviceId: t.haircut }], payments: [{ method: "cash", amountCents: 8_000 }] }),
    ).rejects.toMatchObject({ fieldErrors: { lines: [expect.stringContaining("only be billed once")] } });
    await tenants.updateTenantService({ tenantId: t.id, serviceId: t.haircut, priceCents: 0, durationMinutes: 30, active: true });
    const free = await completedAppointment(t, { serviceId: t.haircut, time: "15:00" }); // booked at the new price of 0
    await expect(pay(t, free, { lines: [{ kind: "catalog", serviceId: t.haircut }], payments: [{ method: "cash", amountCents: 1 }] })).rejects.toMatchObject({
      fieldErrors: { lines: [expect.stringContaining("above zero")] },
    });
  });

  it("validates the submitted shape: integer cents, positive amounts, bounded lists", () => {
    const base = { appointmentId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01", lines: [{ kind: "custom", name: "x", priceCents: 100 }], payments: [{ method: "cash", amountCents: 100 }] };
    const ok = billingSchema.recordPaymentInputSchema.safeParse(base);
    expect(ok.success).toBe(true);
    const bad = (patch: object) => billingSchema.recordPaymentInputSchema.safeParse({ ...base, ...patch }).success;
    expect(bad({ payments: [{ method: "cash", amountCents: 10.5 }] })).toBe(false);
    expect(bad({ payments: [{ method: "cash", amountCents: 0 }] })).toBe(false);
    expect(bad({ payments: [{ method: "bitcoin", amountCents: 100 }] })).toBe(false);
    expect(bad({ payments: [] })).toBe(false);
    expect(bad({ lines: [] })).toBe(false);
    expect(bad({ lines: [{ kind: "custom", name: " ", priceCents: 100 }] })).toBe(false);
    expect(bad({ lines: [{ kind: "custom", name: "x", priceCents: -5 }] })).toBe(false);
    expect(bad({ lines: [{ kind: "custom", name: "x", priceCents: 1.5 }] })).toBe(false);
    expect(bad({ payments: Array.from({ length: 6 }, () => ({ method: "cash", amountCents: 1 })) })).toBe(false);
    expect(billingSchema.parseCheckoutPayload("{not json").success).toBe(false);
    expect(billingSchema.parseCheckoutPayload(undefined).success).toBe(false);
  });
});

describe("recording payment", () => {
  it("persists invoice, lines and ledger rows, then serves a receipt", async () => {
    const t = await newTenant("pay");
    const id = await completedAppointment(t);
    const { invoiceId, created } = await pay(t, id);
    expect(created).toBe(true);

    const [invoice] = await db.select().from(tables.invoices).where(eq(tables.invoices.id, invoiceId));
    expect(invoice).toMatchObject({ tenantId: t.id, branchId: t.branchId, appointmentId: id, customerId: t.customerId, customerName: "Cara Customer", subtotalCents: 12_000, totalCents: 12_000, currency: "USD" });
    expect(invoice!.receiptNumber).toBe("NX-2026-00001");
    const ledger = await db.select().from(tables.payments).where(eq(tables.payments.invoiceId, invoiceId));
    expect(ledger.map((p) => [p.method, p.amountCents, p.appointmentId, p.branchId])).toEqual([["cash", 12_000, id, t.branchId]]);

    const receipt = await billing.getReceipt(t.ctx, invoiceId);
    expect(receipt).toMatchObject({ status: "paid", receiptNumber: "NX-2026-00001", tenantName: "pay", customer: { name: "Cara Customer" }, totalCents: 12_000 });
    expect(receipt.lines.map((l) => [l.name, l.staffName, l.amountCents])).toEqual([["Haircut", "Sam Stylist", 4_000], ["Color", "Sam Stylist", 8_000]]);
    expect(receipt.branch.name).toBe("HQ pay");

    expect((await billing.getCheckout(t.ctx, id)).state).toBe("paid");
    expect((await billing.invoiceIdsByAppointment(t.id, [id])).get(id)).toBe(invoiceId);
    const history = await billing.getCustomerBilling(t.id, t.customerId);
    expect(history).toMatchObject({ paidCount: 1, lifetimeSpendCents: 12_000 });
    expect(history.invoices[0]).toMatchObject({ id: invoiceId, methods: ["cash"] });
  });

  it("supports split payments that reconcile to the total", async () => {
    const t = await newTenant("split");
    const id = await completedAppointment(t);
    const { invoiceId } = await pay(t, id, { payments: [{ method: "cash", amountCents: 5_000 }, { method: "upi", amountCents: 7_000 }] });
    const receipt = await billing.getReceipt(t.ctx, invoiceId);
    expect(receipt.payments.map((p) => [p.method, p.amountCents])).toEqual([["cash", 5_000], ["upi", 7_000]]);
    const revenue = await billing.revenueTodayByBranch(t.id, new Date("2026-10-20T12:00:00Z"));
    expect(revenue.get(t.branchId)).toBe(12_000);
  });

  it("is idempotent: retries and concurrent submits yield one receipt", async () => {
    const t = await newTenant("idem");
    const id = await completedAppointment(t);
    const results = await Promise.all([pay(t, id), pay(t, id), pay(t, id)]);
    expect(new Set(results.map((r) => r.invoiceId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect((await pay(t, id)).created).toBe(false);

    expect(await db.select().from(tables.invoices).where(eq(tables.invoices.tenantId, t.id))).toHaveLength(1);
    expect(await db.select().from(tables.payments).where(eq(tables.payments.tenantId, t.id))).toHaveLength(1);
    expect(await db.select().from(tables.invoiceLines).where(eq(tables.invoiceLines.tenantId, t.id))).toHaveLength(2);
  });

  it("numbers receipts sequentially per tenant", async () => {
    const t = await newTenant("seq");
    const other = await newTenant("seq-other");
    const a = await completedAppointment(t);
    const b = await completedAppointment(t, { time: "15:00" });
    const c = await completedAppointment(other);
    const numbers = [];
    for (const [tenant, appointmentId] of [[t, a], [t, b], [other, c]] as const) {
      numbers.push((await billing.getReceipt(tenant.ctx, (await pay(tenant, appointmentId)).invoiceId)).receiptNumber);
    }
    expect(numbers).toEqual(["NX-2026-00001", "NX-2026-00002", "NX-2026-00001"]);
  });

  it("rolls back everything if a ledger write fails", async () => {
    const t = await newTenant("atomic");
    const id = await completedAppointment(t);
    const repo = await import("@/server/billing/repository");
    // An unknown branch violates the payments FK after the invoice and lines were already inserted.
    await expect(
      repo.createPaidInvoice(t.id, {
        appointmentId: id,
        branchId: "00000000-0000-4000-8000-000000000000",
        customerId: null,
        customerName: null,
        currency: "USD",
        paidAt: NOW,
        lines: [{ serviceId: null, kind: "custom", name: "x", staffName: null, amountCents: 100 }],
        payments: [{ method: "cash", amountCents: 100 }],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(tables.invoices).where(eq(tables.invoices.tenantId, t.id))).toHaveLength(0);
    expect(await db.select().from(tables.invoiceCounters).where(eq(tables.invoiceCounters.tenantId, t.id))).toHaveLength(0);
    await expect(pay(t, id)).resolves.toMatchObject({ created: true });
  });
});

describe("receipt availability and tenant isolation", () => {
  it("has no receipt until a payment is recorded", async () => {
    const t = await newTenant("rcpt");
    const id = await completedAppointment(t);
    expect((await billing.getCheckout(t.ctx, id)).receiptId).toBeNull();
    await expect(billing.getReceipt(t.ctx, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(billing.getReceipt(t.ctx, id)).rejects.toMatchObject({ code: "NOT_FOUND" }); // an appointment id is not a receipt id
  });

  it("never exposes or accepts another tenant's appointments and receipts", async () => {
    const a = await newTenant("iso-a");
    const b = await newTenant("iso-b");
    const apptA = await completedAppointment(a);
    const { invoiceId } = await pay(a, apptA);

    await expect(billing.getReceipt(b.ctx, invoiceId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(billing.getCheckout(b.ctx, apptA)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(billing.recordPayment(b.ctx, billingSchema.recordPaymentInputSchema.parse({ appointmentId: apptA, lines: [{ kind: "custom", name: "x", priceCents: 100 }], payments: [{ method: "cash", amountCents: 100 }] }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await billing.invoiceIdsByAppointment(b.id, [apptA])).size).toBe(0);
    expect((await billing.getOverview(b.id)).recent).toHaveLength(0);
    expect((await billing.getCustomerBilling(b.id, a.customerId)).invoices).toHaveLength(0);
    expect(await appts.listForCustomer(b.id, a.customerId)).toHaveLength(0);
    // Tenant A is unaffected.
    expect((await billing.getReceipt(a.ctx, invoiceId)).totalCents).toBe(12_000);
  });

  it("cannot bill a catalog service from another tenant", async () => {
    const a = await newTenant("iso-svc-a");
    const b = await newTenant("iso-svc-b");
    const id = await completedAppointment(a, { serviceId: a.haircut });
    await expect(pay(a, id, { lines: [{ kind: "catalog", serviceId: b.color }], payments: [{ method: "cash", amountCents: 8_000 }] })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
