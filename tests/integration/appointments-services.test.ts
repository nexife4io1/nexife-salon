import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ctxFor, type Fixture, type FixtureTenant } from "../support/appointments-fixture";

// PGlite-backed, every migration applied: service lines are exercised against real SQL (locks, constraints, backfill).
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

let f: Fixture;
beforeAll(async () => {
  f = await (await import("../support/appointments-fixture")).loadFixture();
});


/** A checked-in appointment with a haircut for `stylist`. */
async function checkedIn(t: FixtureTenant, stylist: string | null, over: Record<string, string | string[]> = {}) {
  const { id } = await f.book(t, { ...(stylist ? { staffId: stylist } : {}), ...over });
  await f.toStatus(t, id, "checked_in");
  return id;
}
const add = (t: FixtureTenant, appointmentId: string, serviceId: string, staffId?: string) =>
  f.appts.addServiceLine(t.ctx, f.schema.addServiceLineInputSchema.parse({ appointmentId, serviceId, staffId: staffId ?? "" }));
const status = (t: FixtureTenant, appointmentId: string, lineId: string, to: "in_progress" | "completed") =>
  f.appts.changeServiceLineStatus(t.ctx, { appointmentId, lineId, status: to }, new Date("2026-10-20T10:30:00Z"));
const reassign = (t: FixtureTenant, appointmentId: string, lineId: string, staffId: string, reason?: string) =>
  f.appts.reassignServiceLine(t.ctx, f.schema.reassignServiceLineInputSchema.parse({ appointmentId, lineId, staffId, reason: reason ?? "" }));
const events = (t: FixtureTenant, id: string) => f.appts.getServicesView(t.ctx, id).then((v) => v.events);

describe("adding services after check-in", () => {
  it("adds a service to a checked-in appointment without changing its status", async () => {
    const t = await f.newTenant("add1");
    const sam = await t.member("Sam");
    const id = await checkedIn(t, sam);
    await add(t, id, t.service("Color"));

    const appt = (await f.appts.findAppointment(t.id, id))!;
    expect(appt.status).toBe("checked_in");
    expect(appt.services.map((l) => [l.name, l.status, l.staffName])).toEqual([["Haircut", "pending", "Sam"], ["Color", "pending", "Sam"]]);
    expect(appt.totalCents).toBe(2_000);
    expect(appt.durationMinutes).toBe(60);
    expect((await events(t, id)).map((e) => e.kind)).toEqual(["added"]);
  });

  it("still works once the visit is in service, and lets the new service go to another qualified team member", async () => {
    const t = await f.newTenant("add2");
    const sam = await t.member("Sam");
    const kim = await t.member("Kim", { serviceIds: [t.service("Color")] });
    const id = await checkedIn(t, sam);
    await f.toStatus(t, id, "in_service");
    await add(t, id, t.service("Color"), kim);
    expect((await f.lines(t, id)).map((l) => l.staffName)).toEqual(["Sam", "Kim"]);
  });

  it("is refused for booked, completed and cancelled appointments (server-side)", async () => {
    const t = await f.newTenant("add3");
    const sam = await t.member("Sam");
    const booked = (await f.book(t, { staffId: sam })).id;
    await expect(add(t, booked, t.service("Color"))).rejects.toMatchObject({ code: "CONFLICT" });

    const done = await checkedIn(t, sam, { time: "11:00" });
    await f.toStatus(t, done, "in_service", "completed");
    await expect(add(t, done, t.service("Color"))).rejects.toMatchObject({ code: "CONFLICT" });

    const cancelled = (await f.book(t, { staffId: sam, time: "12:00" })).id;
    await f.appts.changeStatus(t.ctx, { id: cancelled, status: "cancelled" });
    await expect(add(t, cancelled, t.service("Color"))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces the maximum number of services and rejects duplicates", async () => {
    const t = await f.newTenant("add4");
    const sam = await t.member("Sam");
    const id = await checkedIn(t, sam);
    const names = ["Color", "Perm", "Facial", "Massage", "Manicure", "Pedicure", "Wax", "Threading", "Spa"];
    for (const name of names) await add(t, id, t.service(name));
    expect((await f.lines(t, id)).length).toBe(f.schema.MAX_SERVICES_PER_APPOINTMENT);
    await expect(add(t, id, t.service("Shave"))).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { serviceId: [expect.stringContaining("at most 10")] } });
    await expect(add(t, id, t.service("Color"))).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await f.lines(t, id)).length).toBe(10);
  });

  it("rejects services the branch does not offer and inactive services", async () => {
    const t = await f.newTenant("add5");
    const id = await checkedIn(t, await t.member("Sam"));
    await expect(add(t, id, t.service(t.notOffered))).rejects.toMatchObject({ code: "VALIDATION" });
    await f.tenants.updateTenantService({ tenantId: t.id, serviceId: t.service("Color"), priceCents: 1_000, durationMinutes: 30, active: false });
    await expect(add(t, id, t.service("Color"))).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await f.lines(t, id)).length).toBe(1);
  });

  it("prices the new line from the catalog (never from the client)", async () => {
    const t = await f.newTenant("add6");
    const id = await checkedIn(t, await t.member("Sam"));
    await f.tenants.updateTenantService({ tenantId: t.id, serviceId: t.service("Color"), priceCents: 7_777, durationMinutes: 45, active: true });
    await add(t, id, t.service("Color"));
    expect((await f.lines(t, id)).at(-1)).toMatchObject({ priceCents: 7_777, durationMinutes: 45 });
  });

  it("validates tenant, branch, activity and qualification of the team member", async () => {
    const a = await f.newTenant("tenant-a");
    const b = await f.newTenant("tenant-b");
    const id = await checkedIn(a, await a.member("Sam"));

    // Another tenant can neither see nor change this appointment, and its staff are not valid here.
    await expect(add(b, id, b.service("Color"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(add(a, id, a.service("Color"), await b.member("Outsider"))).rejects.toMatchObject({ fieldErrors: { staffId: expect.any(Array) } });

    // Another branch of the same tenant.
    const [other] = await f.db.insert(f.tables.branches).values({ tenantId: a.id, name: "Second", addressLine: "2 Side St" }).returning();
    await expect(add(a, id, a.service("Color"), await a.member("Elsewhere", { branchId: other!.id }))).rejects.toMatchObject({ fieldErrors: { staffId: expect.any(Array) } });

    // Inactive and unqualified.
    const gone = await a.member("Gone");
    await f.staffService.setStatus(a.ctx, gone, "inactive");
    await expect(add(a, id, a.service("Color"), gone)).rejects.toMatchObject({ fieldErrors: { staffId: expect.any(Array) } });
    const narrow = await a.member("Narrow", { serviceIds: [a.service("Perm")] });
    await expect(add(a, id, a.service("Color"), narrow)).rejects.toMatchObject({ fieldErrors: { staffId: [expect.stringContaining("doesn't perform")] } });

    expect((await f.lines(a, id)).length).toBe(1);
  });
});

describe("running services", () => {
  it("starting the first service puts a checked-in visit in service; finishing services never completes the visit", async () => {
    const t = await f.newTenant("run1");
    const sam = await t.member("Sam");
    const id = await checkedIn(t, sam);
    await add(t, id, t.service("Color"));
    const [first, second] = await f.lines(t, id);

    await status(t, id, first!.id, "in_progress");
    expect((await f.appts.findAppointment(t.id, id))!.status).toBe("in_service");
    await status(t, id, first!.id, "completed");
    expect((await f.appts.findAppointment(t.id, id))!.status).toBe("in_service"); // work remains

    // A service added after another finished leaves the visit in service, not completed.
    await add(t, id, t.service("Perm"));
    await status(t, id, second!.id, "in_progress");
    await status(t, id, second!.id, "completed");
    const appt = (await f.appts.findAppointment(t.id, id))!;
    expect(appt.status).toBe("in_service");
    expect(appt.services.map((l) => l.status)).toEqual(["completed", "completed", "pending"]);
    expect(appt.services[0]).toMatchObject({ performedByName: "Sam", staffName: "Sam" });
    expect(appt.services[0]!.completedAt).toBeInstanceOf(Date);
  });

  it("only allows legal service moves and applies a double submit once", async () => {
    const t = await f.newTenant("run2");
    const id = await checkedIn(t, await t.member("Sam"));
    const [line] = await f.lines(t, id);
    await expect(status(t, id, line!.id, "completed")).rejects.toMatchObject({ code: "CONFLICT" }); // pending -> completed is not a move
    const results = await Promise.allSettled([status(t, id, line!.id, "in_progress"), status(t, id, line!.id, "in_progress")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await events(t, id)).filter((e) => e.kind === "started")).toHaveLength(1);
    await status(t, id, line!.id, "completed");
    await expect(status(t, id, line!.id, "in_progress")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("needs a team member before a service can start", async () => {
    const t = await f.newTenant("run3");
    const sam = await t.member("Sam");
    const id = await checkedIn(t, null);
    const [line] = await f.lines(t, id);
    await expect(status(t, id, line!.id, "in_progress")).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { staffId: expect.any(Array) } });
    await reassign(t, id, line!.id, sam);
    await status(t, id, line!.id, "in_progress");
    expect((await f.lines(t, id))[0]).toMatchObject({ status: "in_progress", staffName: "Sam" });
  });

  it("removes only untouched services and never the last one", async () => {
    const t = await f.newTenant("run4");
    const id = await checkedIn(t, await t.member("Sam"));
    await add(t, id, t.service("Color"));
    const [first, second] = await f.lines(t, id);
    await status(t, id, first!.id, "in_progress");
    await expect(f.appts.removeServiceLine(t.ctx, { appointmentId: id, lineId: first!.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await f.appts.removeServiceLine(t.ctx, { appointmentId: id, lineId: second!.id });
    await expect(f.appts.removeServiceLine(t.ctx, { appointmentId: id, lineId: first!.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await f.lines(t, id)).map((l) => l.name)).toEqual(["Haircut"]);
    expect((await events(t, id)).map((e) => e.kind)).toEqual(["added", "started", "removed"]);
  });

  it("completing the appointment closes every open service and records who did it", async () => {
    const t = await f.newTenant("run5");
    const sam = await t.member("Sam");
    const id = await checkedIn(t, sam);
    await add(t, id, t.service("Color"));
    await f.toStatus(t, id, "in_service", "completed");
    const appt = (await f.appts.findAppointment(t.id, id))!;
    expect(appt.status).toBe("completed");
    expect(appt.services.map((l) => [l.status, l.performedByName])).toEqual([["completed", "Sam"], ["completed", "Sam"]]);
    expect((await events(t, id)).filter((e) => e.kind === "completed")).toHaveLength(2);
    // Money and identity of the visit are untouched.
    expect(appt).toMatchObject({ customerName: "Cara Customer", staffName: "Sam", totalCents: 2_000 });
  });
});

describe("reassigning and correcting the team member", () => {
  it("reassigns an open service, keeps the visit's lead in step for a single-service visit, and logs it", async () => {
    const t = await f.newTenant("re1");
    const sam = await t.member("Sam");
    const kim = await t.member("Kim");
    const id = await checkedIn(t, sam);
    const [line] = await f.lines(t, id);
    await reassign(t, id, line!.id, kim);
    const appt = (await f.appts.findAppointment(t.id, id))!;
    expect(appt.services[0]!.staffName).toBe("Kim");
    expect(appt.staffName).toBe("Kim");
    expect((await events(t, id)).at(-1)).toMatchObject({ kind: "reassigned", fromStaffName: "Sam", toStaffName: "Kim" });
    await expect(reassign(t, id, line!.id, kim)).rejects.toMatchObject({ code: "VALIDATION" }); // unchanged
  });

  it("keeps the lead team member when a multi-service visit is shared between people", async () => {
    const t = await f.newTenant("re2");
    const sam = await t.member("Sam");
    const kim = await t.member("Kim");
    const id = await checkedIn(t, sam);
    await add(t, id, t.service("Color"), kim);
    const appt = (await f.appts.findAppointment(t.id, id))!;
    expect(appt.staffName).toBe("Sam");
    expect(appt.services.map((l) => l.staffName)).toEqual(["Sam", "Kim"]);
  });

  it("corrects a completed service with a reason without rewriting who performed it or when", async () => {
    const t = await f.newTenant("re3");
    const sam = await t.member("Sam");
    const kim = await t.member("Kim");
    const id = await checkedIn(t, sam);
    await f.toStatus(t, id, "in_service", "completed");
    const [before] = await f.lines(t, id);

    await expect(reassign(t, id, before!.id, kim)).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { reason: expect.any(Array) } });
    await expect(reassign(t, id, before!.id, kim, "x")).rejects.toMatchObject({ code: "VALIDATION" });
    await reassign(t, id, before!.id, kim, "Entered the wrong stylist at check-in");

    const [after] = await f.lines(t, id);
    expect(after).toMatchObject({ staffName: "Kim", status: "completed", performedByName: "Sam" });
    expect(after!.completedAt).toEqual(before!.completedAt);
    expect((await f.appts.findAppointment(t.id, id))!.status).toBe("completed");
    expect((await events(t, id)).at(-1)).toMatchObject({ kind: "corrected", fromStaffName: "Sam", toStaffName: "Kim", reason: "Entered the wrong stylist at check-in" });

    // A second correction keeps the original record and adds to the trail.
    await reassign(t, id, before!.id, sam, "Changed back after checking the rota");
    expect((await f.lines(t, id))[0]).toMatchObject({ staffName: "Sam", performedByName: "Sam" });
    expect((await events(t, id)).filter((e) => e.kind === "corrected")).toHaveLength(2);
  });

  it("refuses reassignment for cancelled, no-show and booked appointments, and for foreign or ineligible staff", async () => {
    const a = await f.newTenant("re4");
    const b = await f.newTenant("re4b");
    const sam = await a.member("Sam");
    const kim = await a.member("Kim");
    const booked = (await f.book(a, { staffId: sam })).id;
    const [bookedLine] = await f.lines(a, booked);
    await expect(reassign(a, booked, bookedLine!.id, kim)).rejects.toMatchObject({ code: "CONFLICT" });
    await f.appts.changeStatus(a.ctx, { id: booked, status: "cancelled" });
    await expect(reassign(a, booked, bookedLine!.id, kim)).rejects.toMatchObject({ code: "CONFLICT" });

    const id = await checkedIn(a, sam, { time: "11:00" });
    const [line] = await f.lines(a, id);
    await expect(reassign(a, id, line!.id, await b.member("Outsider"))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(f.appts.reassignServiceLine(b.ctx, { appointmentId: id, lineId: line!.id, staffId: kim })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reassign(a, id, "7d3c9f62-1d0a-4e1b-9a55-ffffffffffff", kim)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await f.lines(a, id))[0]!.staffName).toBe("Sam");
  });

  it("never alters an issued invoice, its payments or its receipt number when a team member is corrected", async () => {
    const t = await f.newTenant("re5");
    const sam = await t.member("Sam");
    const kim = await t.member("Kim");
    const id = await checkedIn(t, sam);
    await f.toStatus(t, id, "in_service", "completed");
    const billing = await import("@/server/billing/service");
    const billingSchema = await import("@/server/billing/schema");
    const { invoiceId } = await billing.recordPayment(
      t.ctx,
      billingSchema.recordPaymentInputSchema.parse({ appointmentId: id, lines: [{ kind: "catalog", serviceId: t.service("Haircut") }], payments: [{ method: "cash", amountCents: 1_000 }] }),
      new Date("2026-10-20T11:00:00Z"),
    );
    const snapshot = async () => ({
      invoice: await f.db.select().from(f.tables.invoices).where(eq(f.tables.invoices.id, invoiceId)),
      lines: await f.db.select().from(f.tables.invoiceLines).where(eq(f.tables.invoiceLines.invoiceId, invoiceId)),
      payments: await f.db.select().from(f.tables.payments).where(eq(f.tables.payments.invoiceId, invoiceId)),
    });
    const before = await snapshot();

    const [line] = await f.lines(t, id);
    await reassign(t, id, line!.id, kim, "Wrong stylist recorded");

    expect(await snapshot()).toEqual(before);
    expect(before.lines[0]!.staffName).toBe("Sam"); // the receipt still says who was recorded when it was issued
    expect((await f.lines(t, id))[0]).toMatchObject({ staffName: "Kim", performedByName: "Sam" });
  });
});

describe("board and booking options", () => {
  const NOW = new Date("2026-10-20T08:00:00Z");
  const board = (t: FixtureTenant, raw: Record<string, string> = {}) => f.appts.getBoard(t.ctx, f.schema.parseAppointmentFilters({ date: "2026-10-20", ...raw }), NOW);

  it("keeps Upcoming to work still to do but lists the day's completed appointments right under it", async () => {
    const t = await f.newTenant("board1");
    const sam = await t.member("Sam");
    const open = (await f.book(t, { staffId: sam })).id;
    const done = (await f.book(t, { staffId: sam, time: "11:00" })).id;
    await f.toStatus(t, done, "checked_in", "in_service", "completed");

    const upcoming = await board(t);
    expect(upcoming.appointments.map((a) => a.id)).toEqual([open]);
    expect(upcoming.completed.map((a) => a.id)).toEqual([done]);
    expect(upcoming.completed[0]).toMatchObject({ customerName: "Cara Customer", serviceName: "Haircut", staffName: "Sam", totalCents: 1_000, status: "completed" });
    expect(upcoming.counts.completed).toBe(1);

    // The one-step Completed view shows it in the columns and does not list it twice.
    const only = await board(t, { status: "completed" });
    expect(only.appointments.map((a) => a.id)).toEqual([done]);
    expect(only.completed).toEqual([]);
    expect((await board(t, { status: "all" })).completed).toEqual([]);
  });

  it("scopes the completed list to the selected day and branch", async () => {
    const t = await f.newTenant("board2");
    const sam = await t.member("Sam");
    const other = (await f.book(t, { staffId: sam, date: "2026-10-21" })).id;
    await f.toStatus(t, other, "checked_in", "in_service", "completed");
    expect((await board(t)).completed).toEqual([]);
    expect((await board(t, { date: "2026-10-21" })).completed.map((a) => a.id)).toEqual([other]);
  });

  it("searches the whole customer directory, not just the preloaded start of the list", async () => {
    const t = await f.newTenant("cust1");
    const rows = Array.from({ length: 30 }, (_, i) => ({ tenantId: t.id, name: `Bulk ${String(i).padStart(2, "0")}`, phone: `+1555123${String(i).padStart(4, "0")}`, phoneKey: `1555123${String(i).padStart(4, "0")}` }));
    await f.db.insert(f.tables.customers).values(rows);
    const options = await f.appts.getBookingOptions(t.ctx, NOW);
    expect(options.customers).toHaveLength(f.schema.CUSTOMER_PICKER_LIMIT);
    expect(options.customersTruncated).toBe(true);

    const preloaded = new Set(options.customers.map((c) => c.id));
    const byName = await f.appts.searchCustomerChoices(t.ctx, "bulk 29");
    expect(byName.map((c) => c.name)).toEqual(["Bulk 29"]);
    const byPhone = await f.appts.searchCustomerChoices(t.ctx, "5551230012");
    expect(byPhone.map((c) => c.name)).toEqual(["Bulk 12"]);
    // Every customer is findable, including the ones the starting list left out.
    const found = await Promise.all(rows.map(async (r) => (await f.appts.searchCustomerChoices(t.ctx, r.name))[0]!));
    expect(found.map((c) => c.name)).toEqual(rows.map((r) => r.name));
    expect(found.filter((c) => !preloaded.has(c.id)).length).toBeGreaterThanOrEqual(10);
    expect(await f.appts.searchCustomerChoices(t.ctx, "   ")).toEqual([]);
    // Another tenant's directory is never searched.
    expect(await f.appts.searchCustomerChoices(ctxFor((await f.newTenant("cust2")).id), "bulk")).toEqual([]);
  });

  it("does not flag a small directory as truncated", async () => {
    const t = await f.newTenant("cust3");
    const options = await f.appts.getBookingOptions(t.ctx, NOW);
    expect(options.customersTruncated).toBe(false);
    expect(options.customers.map((c) => c.name)).toEqual(["Cara Customer"]);
  });
});

describe("migration backfill", () => {
  it("gives lines the status, team member and performer of the appointment they belong to", async () => {
    const t = await f.newTenant("backfill");
    const sam = await t.member("Sam");
    const id = (await f.book(t, { staffId: sam })).id;
    const rows = await f.db.select().from(f.tables.appointmentServices).where(and(eq(f.tables.appointmentServices.appointmentId, id)));
    // New bookings write the same shape the backfill produces for old rows.
    expect(rows[0]).toMatchObject({ status: "pending", staffId: sam, performedByStaffId: null });
  });
});
