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
        tips: [{ amountCents: 50, staffId: t.member, staffName: "Sam Stylist" }],
        payments: [{ method: "cash", amountCents: 150 }],
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

describe("editing a service price on the bill", () => {
  it("bills the edited price on this invoice only, leaving the catalog and the booking untouched", async () => {
    const t = await newTenant("price-edit");
    const id = await completedAppointment(t);
    const { invoiceId } = await pay(t, id, {
      lines: [{ kind: "catalog", serviceId: t.haircut, priceCents: 3_500 }, { kind: "catalog", serviceId: t.color }],
      payments: [{ method: "cash", amountCents: 11_500 }], // 3,500 (edited) + 8,000
    });
    const receipt = await billing.getReceipt(t.ctx, invoiceId);
    expect(receipt.lines.map((l) => [l.name, l.amountCents])).toEqual([["Haircut", 3_500], ["Color", 8_000]]);
    expect(receipt).toMatchObject({ subtotalCents: 11_500, tipCents: 0, totalCents: 11_500 });

    const catalog = await db.select().from(tables.services).where(eq(tables.services.id, t.haircut));
    expect(catalog[0]!.priceCents).toBe(4_000);
    const booked = await db.select().from(tables.appointmentServices).where(eq(tables.appointmentServices.appointmentId, id));
    expect(booked.map((l) => l.priceCents).sort()).toEqual([4_000, 8_000]);
  });

  it("also prices a service added at checkout, and still requires payments to match the edited total", async () => {
    const t = await newTenant("price-edit-added");
    const id = await completedAppointment(t, { serviceId: t.haircut });
    await expect(pay(t, id, { lines: [{ kind: "catalog", serviceId: t.color, priceCents: 7_000 }], payments: [{ method: "cash", amountCents: 8_000 }] })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { payments: [expect.stringContaining("bill is $70")] },
    });
    const { invoiceId } = await pay(t, id, { lines: [{ kind: "catalog", serviceId: t.color, priceCents: 7_000 }], payments: [{ method: "cash", amountCents: 7_000 }] });
    expect((await billing.getReceipt(t.ctx, invoiceId)).totalCents).toBe(7_000);
  });

  it("rejects unusable prices", () => {
    const parse = (priceCents: unknown) =>
      billingSchema.recordPaymentInputSchema.safeParse({
        appointmentId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01",
        lines: [{ kind: "catalog", serviceId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02", priceCents }],
        payments: [{ method: "cash", amountCents: 100 }],
      }).success;
    expect(parse(0)).toBe(true);
    expect(parse(undefined)).toBe(true);
    expect(parse(-1)).toBe(false);
    expect(parse(10.5)).toBe(false);
    expect(parse(billingSchema.MAX_LINE_CENTS + 1)).toBe(false);
  });
});

describe("tips", () => {
  it("splits the tip across several team members, on top of the services, and shows each on the receipt", async () => {
    const t = await newTenant("tip");
    const second = (await staff.createStaff(t.ctx, staffSchema.staffInputSchema.parse({ name: "Robin Assistant", branchId: t.branchId }))).id;
    const id = await completedAppointment(t);
    const checkout = await billing.getCheckout(t.ctx, id);
    expect(checkout.staff.map((s) => s.name).sort()).toEqual(["Robin Assistant", "Sam Stylist"]);
    expect(checkout.defaultTipStaffId).toBe(t.member);

    const { invoiceId } = await pay(t, id, {
      tips: [
        { amountCents: 1_500, staffId: t.member },
        { amountCents: 500, staffId: second },
      ],
      payments: [{ method: "cash", amountCents: 11_000 }, { method: "card", amountCents: 3_000 }],
    });
    const receipt = await billing.getReceipt(t.ctx, invoiceId);
    expect(receipt).toMatchObject({ subtotalCents: 12_000, tipCents: 2_000, totalCents: 14_000 });
    expect(receipt.tips.map((x) => [x.staffName, x.amountCents])).toEqual([["Sam Stylist", 1_500], ["Robin Assistant", 500]]);
    const [invoice] = await db.select().from(tables.invoices).where(eq(tables.invoices.id, invoiceId));
    expect(invoice).toMatchObject({ subtotalCents: 12_000, tipCents: 2_000, tipStaffId: null, tipStaffName: null, totalCents: 14_000 });
    const rows = await db.select().from(tables.invoiceTips).where(eq(tables.invoiceTips.invoiceId, invoiceId));
    expect(rows.map((r) => r.staffId).sort()).toEqual([t.member, second].sort());
    expect(rows.reduce((sum, r) => sum + r.amountCents, 0)).toBe(invoice!.tipCents);
    const ledger = await db.select().from(tables.payments).where(eq(tables.payments.invoiceId, invoiceId));
    expect(ledger.reduce((sum, p) => sum + p.amountCents, 0)).toBe(14_000);
  });

  it("allows several tip rows for the same team member and keeps them separate", async () => {
    const t = await newTenant("tip-repeat");
    const id = await completedAppointment(t);
    const { invoiceId } = await pay(t, id, {
      tips: [
        { amountCents: 700, staffId: t.member },
        { amountCents: 300, staffId: t.member },
      ],
      payments: [{ method: "cash", amountCents: 13_000 }],
    });
    const receipt = await billing.getReceipt(t.ctx, invoiceId);
    expect(receipt.tipCents).toBe(1_000);
    expect(receipt.tips.map((x) => x.amountCents)).toEqual([700, 300]);
  });

  it("requires the payments to cover services plus every tip, under or over", async () => {
    const t = await newTenant("tip-total");
    const id = await completedAppointment(t);
    const tips = [{ amountCents: 500, staffId: t.member }, { amountCents: 250, staffId: t.member }];
    await expect(pay(t, id, { tips, payments: [{ method: "cash", amountCents: 12_500 }] })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { payments: [expect.stringContaining("bill is $127.50")] },
    });
    await expect(pay(t, id, { tips, payments: [{ method: "cash", amountCents: 13_000 }] })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { payments: [expect.stringContaining("over")] } });
    expect(await db.select().from(tables.invoices).where(eq(tables.invoices.tenantId, t.id))).toHaveLength(0);
    expect(await db.select().from(tables.invoiceTips).where(eq(tables.invoiceTips.tenantId, t.id))).toHaveLength(0);
  });

  it("is optional: no tips means a zero tip and an empty breakdown", async () => {
    const t = await newTenant("tip-none");
    const id = await completedAppointment(t);
    const { invoiceId } = await pay(t, id);
    expect(await billing.getReceipt(t.ctx, invoiceId)).toMatchObject({ tipCents: 0, tips: [] });
    const parsed = billingSchema.recordPaymentInputSchema.parse({ appointmentId: id, lines: [{ kind: "custom", name: "x", priceCents: 100 }], payments: [{ method: "cash", amountCents: 100 }] });
    expect(parsed.tips).toEqual([]);
  });

  it("only credits an active team member at the appointment's branch in this tenant", async () => {
    const t = await newTenant("tip-who");
    const other = await newTenant("tip-who-other");
    const [second] = await db.insert(tables.branches).values({ tenantId: t.id, name: "Second", addressLine: "2 Side St" }).returning();
    const away = (await staff.createStaff(t.ctx, staffSchema.staffInputSchema.parse({ name: "Away Alex", branchId: second!.id }))).id;
    const retired = (await staff.createStaff(t.ctx, staffSchema.staffInputSchema.parse({ name: "Retired Rita", branchId: t.branchId }))).id;
    await staff.setStatus(t.ctx, retired, "inactive");
    const id = await completedAppointment(t);

    for (const staffId of [away, retired, other.member, "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02"]) {
      // One bad recipient anywhere in the list rejects the whole bill.
      await expect(
        pay(t, id, { tips: [{ amountCents: 500, staffId: t.member }, { amountCents: 500, staffId }], payments: [{ method: "cash", amountCents: 13_000 }] }),
      ).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { tips: expect.any(Array) } });
    }
    expect(await db.select().from(tables.invoices).where(eq(tables.invoices.tenantId, t.id))).toHaveLength(0);
    expect((await billing.getCheckout(t.ctx, id)).staff.map((s) => s.name)).toEqual(["Sam Stylist"]);
  });

  it("keeps the staff name on the receipt after the team member is renamed or removed", async () => {
    const t = await newTenant("tip-snapshot");
    const id = await completedAppointment(t);
    const { invoiceId } = await pay(t, id, { tips: [{ amountCents: 400, staffId: t.member }], payments: [{ method: "cash", amountCents: 12_400 }] });
    await db.update(tables.staff).set({ name: "Renamed" }).where(eq(tables.staff.id, t.member));
    expect((await billing.getReceipt(t.ctx, invoiceId)).tips[0]).toMatchObject({ staffName: "Sam Stylist", amountCents: 400 });
    await db.delete(tables.staff).where(eq(tables.staff.id, t.member));
    expect((await billing.getReceipt(t.ctx, invoiceId)).tips[0]).toMatchObject({ staffName: "Sam Stylist", amountCents: 400 });
  });

  it("still reads an invoice that only has the legacy single-tip fields", async () => {
    const t = await newTenant("tip-legacy");
    const [invoice] = await db
      .insert(tables.invoices)
      .values({ tenantId: t.id, branchId: t.branchId, receiptNumber: "NX-2026-09999", currency: "USD", subtotalCents: 5_000, tipCents: 800, tipStaffId: t.member, tipStaffName: "Old Name", totalCents: 5_800 })
      .returning();
    await db.insert(tables.payments).values({ tenantId: t.id, branchId: t.branchId, invoiceId: invoice!.id, amountCents: 5_800, method: "cash" });
    const receipt = await billing.getReceipt(t.ctx, invoice!.id);
    expect(receipt).toMatchObject({ tipCents: 800, totalCents: 5_800 });
    expect(receipt.tips).toEqual([{ id: expect.any(String), staffName: "Old Name", amountCents: 800 }]);
  });

  it("validates the submitted tips", () => {
    const parse = (tips: unknown) =>
      billingSchema.recordPaymentInputSchema.safeParse({
        appointmentId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01",
        lines: [{ kind: "custom", name: "x", priceCents: 100 }],
        payments: [{ method: "cash", amountCents: 100 }],
        tips,
      }).success;
    const staffId = "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02";
    expect(parse(undefined)).toBe(true);
    expect(parse([])).toBe(true);
    expect(parse([{ amountCents: 100, staffId }, { amountCents: 200, staffId }])).toBe(true);
    expect(parse([{ amountCents: 0, staffId }])).toBe(false);
    expect(parse([{ amountCents: -5, staffId }])).toBe(false);
    expect(parse([{ amountCents: 1.5, staffId }])).toBe(false);
    expect(parse([{ amountCents: billingSchema.MAX_LINE_CENTS + 1, staffId }])).toBe(false);
    expect(parse([{ amountCents: 100 }])).toBe(false);
    expect(parse([{ amountCents: 100, staffId: "nope" }])).toBe(false);
    expect(parse({ amountCents: 100, staffId })).toBe(false);
    expect(parse(Array.from({ length: billingSchema.MAX_TIP_ROWS + 1 }, () => ({ amountCents: 1, staffId })))).toBe(false);
  });
});

describe("billing history", () => {
  it("lists the customer on each payment, and 'no customer' for a walk-in bill", async () => {
    const t = await newTenant("history-customer");
    await pay(t, await completedAppointment(t));
    const walkIn = await book(t, { type: "walk_in", customerId: "", date: "", time: "" });
    for (const status of ["checked_in", "in_service", "completed"] as const) await appts.changeStatus(t.ctx, { id: walkIn.id, status });
    await pay(t, walkIn.id);

    const { recent } = await billing.getOverview(t.id);
    expect(recent.map((p) => p.customerName).sort()).toEqual(["Cara Customer", null]);
  });

  it("filters the history by branch, within the tenant", async () => {
    const t = await newTenant("history-branch");
    const other = await newTenant("history-branch-other");
    const branchesService = await import("@/server/branches/service");
    const second = await branchesService.createBranch(t.ctx, { name: "Second", addressLine: "2 Side St", status: "active", serviceIds: [t.haircut] });
    const member = (await staff.createStaff(t.ctx, staffSchema.staffInputSchema.parse({ name: "Second Sam", branchId: second.id }))).id;

    await pay(t, await completedAppointment(t));
    const there = await completedAppointment(t, { branchId: second.id, staffId: member, serviceId: t.haircut, time: "15:00" });
    await pay(t, there, { lines: [{ kind: "catalog", serviceId: t.haircut }], payments: [{ method: "cash", amountCents: 4_000 }] });
    await pay(other, await completedAppointment(other));

    const names = (view: Awaited<ReturnType<typeof billing.getOverview>>) => view.recent.map((p) => p.branchId).sort();
    const all = await billing.getOverview(t.id);
    expect(names(all)).toEqual([t.branchId, second.id].sort());
    expect(all.branches.map((b) => b.id).sort()).toEqual([t.branchId, second.id].sort());

    const filtered = await billing.getOverview(t.id, new Date(), { branchId: second.id });
    expect(filtered.recent.map((p) => [p.branchId, p.amountCents])).toEqual([[second.id, 4_000]]);
    expect(filtered.filters).toEqual({ branchId: second.id });
    // Another tenant's branch id never leaks that tenant's payments.
    expect((await billing.getOverview(t.id, new Date(), { branchId: other.branchId })).recent).toEqual([]);
  });

  it("parses the branch filter leniently", () => {
    expect(billingSchema.parseBillingFilters({ branchId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01" })).toEqual({ branchId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01" });
    expect(billingSchema.parseBillingFilters({ branchId: "nope" })).toEqual({ branchId: undefined });
    expect(billingSchema.parseBillingFilters({})).toEqual({ branchId: undefined });
  });
});

describe("deleting an appointment keeps billing history", () => {
  it("leaves the invoice, lines and payments in place, just unlinked from the appointment", async () => {
    const t = await newTenant("delete-paid");
    const id = await completedAppointment(t);
    const { invoiceId } = await pay(t, id);

    await appts.deleteAppointment(t.ctx, id);

    const [invoice] = await db.select().from(tables.invoices).where(eq(tables.invoices.id, invoiceId));
    expect(invoice).toMatchObject({ appointmentId: null, customerName: "Cara Customer", totalCents: 12_000 });
    expect(await db.select().from(tables.invoiceLines).where(eq(tables.invoiceLines.invoiceId, invoiceId))).toHaveLength(2);
    const ledger = await db.select().from(tables.payments).where(eq(tables.payments.invoiceId, invoiceId));
    expect(ledger.map((p) => [p.amountCents, p.appointmentId])).toEqual([[12_000, null]]);
    expect((await billing.getReceipt(t.ctx, invoiceId)).totalCents).toBe(12_000);
    expect((await billing.getOverview(t.id)).recent).toHaveLength(1);
  });
});
