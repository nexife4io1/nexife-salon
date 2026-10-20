import "server-only";
import { utcDayRange } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { TenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
// Cross-domain reads go through other domains' services — never their repositories.
import * as appointmentsService from "@/server/appointments/service";
import * as branchesService from "@/server/branches/service";
import * as staffService from "@/server/staff/service";
import * as tenantsService from "@/server/tenants/service";
import * as repo from "./repository";
import type { BillingFilters, BillingOverview, CheckoutLine, CheckoutView, CustomerBilling, ReceiptView, RecordPaymentInput } from "./schema";

export function revenueTodayByBranch(tenantId: string, now = new Date()) {
  const { start, end } = utcDayRange(now);
  return repo.sumByBranchBetween(tenantId, start, end);
}

export function listRecentPayments(tenantId: string) {
  return repo.listRecent(tenantId);
}

const validation = (field: string, message: string) => new AppError("VALIDATION", "Please fix the highlighted fields.", { [field]: [message] });

// --- Overview ------------------------------------------------------------------------------------------

/** Completed appointments that have no invoice yet: the services are done but still payable. */
async function listOpenTickets(tenantId: string) {
  const completed = await appointmentsService.listCompleted(tenantId);
  const paid = await repo.invoiceIdsByAppointment(
    tenantId,
    completed.map((a) => a.id),
  );
  return completed
    .filter((a) => !paid.has(a.id))
    .map((a) => ({
      appointmentId: a.id,
      customerName: a.customerName,
      serviceName: a.serviceName,
      staffName: a.staffName,
      startsAt: a.startsAt,
      totalCents: a.totalCents,
    }));
}

/** `filters.branchId` narrows the payment history only; the day's totals and open tickets stay tenant-wide. */
export async function getOverview(tenantId: string, now = new Date(), filters: BillingFilters = {}): Promise<BillingOverview> {
  const { start, end } = utcDayRange(now);
  const [tenant, recent, byBranch, stats, openTickets, branchOverview] = await Promise.all([
    tenantsService.getTenant(tenantId),
    repo.listRecent(tenantId, undefined, filters.branchId),
    revenueTodayByBranch(tenantId, now),
    repo.invoiceStatsBetween(tenantId, start, end),
    listOpenTickets(tenantId),
    branchesService.getOverview(tenantId),
  ]);
  return {
    recent,
    branches: branchOverview.branches.map((b) => ({ id: b.id, name: b.name })),
    filters,
    openTickets,
    revenueTodayCents: [...byBranch.values()].reduce((a, b) => a + b, 0),
    averageTicketTodayCents: stats.count ? Math.round(stats.totalCents / stats.count) : null,
    currency: tenant.currency,
    timezone: tenant.timezone,
    source: repo.dataSource(),
  };
}

/** A customer's billing history: recent receipts plus all-time totals. */
export async function getCustomerBilling(tenantId: string, customerId: string, limit = 50): Promise<CustomerBilling> {
  const [tenant, invoices, totals] = await Promise.all([
    tenantsService.getTenant(tenantId),
    repo.listInvoicesForCustomer(tenantId, customerId, limit),
    repo.customerTotals(tenantId, customerId),
  ]);
  return { currency: tenant.currency, timezone: tenant.timezone, invoices, paidCount: totals.count, lifetimeSpendCents: totals.totalCents };
}

/** appointment id -> invoice id for the paid ones among `appointmentIds` (drives Paid badges and Receipt links). */
export function invoiceIdsByAppointment(tenantId: string, appointmentIds: string[]) {
  return repo.invoiceIdsByAppointment(tenantId, appointmentIds);
}

// --- Checkout ------------------------------------------------------------------------------------------

/** Active team members at a branch: the people a tip can be credited to. */
async function tipRecipients(tenantId: string, branchId: string): Promise<{ id: string; name: string }[]> {
  return (await staffService.listStaff(tenantId)).filter((s) => s.active && s.branchId === branchId).map((s) => ({ id: s.id, name: s.name }));
}

export async function getCheckout(ctx: TenantContext, appointmentId: string): Promise<CheckoutView> {
  const appointment = await appointmentsService.findAppointment(ctx.tenantId, appointmentId);
  if (!appointment) throw new AppError("NOT_FOUND", "Appointment not found.");

  const [tenant, branch, invoiceIds, offered, catalog, team] = await Promise.all([
    tenantsService.getTenant(ctx.tenantId),
    branchesService.getBranch(ctx.tenantId, appointment.branchId),
    repo.invoiceIdsByAppointment(ctx.tenantId, [appointment.id]),
    branchesService.getBranchServices(ctx, appointment.branchId),
    tenantsService.listTenantServices(ctx.tenantId),
    tipRecipients(ctx.tenantId, appointment.branchId),
  ]);
  const receiptId = invoiceIds.get(appointment.id) ?? null;
  const offeredIds = new Set(offered.offeredIds);

  return {
    state: receiptId ? "paid" : appointment.status === "completed" ? "ready" : "not_ready",
    receiptId,
    appointment: {
      id: appointment.id,
      status: appointment.status,
      startsAt: appointment.startsAt,
      customerId: appointment.customerId,
      customerName: appointment.customerName,
      staffName: appointment.staffName,
      branchName: branch.name,
    },
    staff: team,
    defaultTipStaffId: team.some((s) => s.id === appointment.staffId) ? appointment.staffId : null,
    currency: tenant.currency,
    timezone: tenant.timezone,
    lines: appointment.services.map(
      (line): CheckoutLine => ({ key: line.id, kind: "catalog", serviceId: line.serviceId, name: line.name, priceCents: line.priceCents }),
    ),
    catalog: catalog.filter((s) => s.active && offeredIds.has(s.id)).map((s) => ({ id: s.id, name: s.name, category: s.category, priceCents: s.priceCents })),
    source: repo.dataSource(),
  };
}

/**
 * Turn the submitted bill into trusted lines. Services that were booked keep their booked name and price; a
 * service added at checkout must be an active service this branch offers and is priced from the catalog;
 * one-off items are accepted as typed. A catalog line may carry a price for this bill only (see
 * `checkoutLineInputSchema`); the catalog and the appointment's booked price are never changed by it.
 */
async function resolveLines(ctx: TenantContext, appointment: NonNullable<Awaited<ReturnType<typeof appointmentsService.findAppointment>>>, input: RecordPaymentInput) {
  const booked = new Map(appointment.services.flatMap((s) => (s.serviceId ? [[s.serviceId, s] as const] : [])));
  const needsCatalog = input.lines.some((l) => l.kind === "catalog" && !booked.has(l.serviceId));
  const catalog = needsCatalog ? new Map((await tenantsService.listTenantServices(ctx.tenantId)).map((s) => [s.id, s])) : new Map();
  const offered = needsCatalog ? new Set((await branchesService.getBranchServices(ctx, appointment.branchId)).offeredIds) : new Set<string>();

  const seen = new Set<string>();
  return input.lines.map((line) => {
    if (line.kind === "custom") return { serviceId: null, kind: "custom" as const, name: line.name, staffName: null, amountCents: line.priceCents };
    if (seen.has(line.serviceId)) throw validation("lines", "Each service can only be billed once");
    seen.add(line.serviceId);
    const snapshot = booked.get(line.serviceId);
    if (snapshot) return { serviceId: line.serviceId, kind: "catalog" as const, name: snapshot.name, staffName: appointment.staffName, amountCents: line.priceCents ?? snapshot.priceCents };
    const service = catalog.get(line.serviceId);
    if (!service || !service.active || !offered.has(service.id)) throw validation("lines", "One of the services isn't available at this branch");
    return { serviceId: service.id, kind: "catalog" as const, name: service.name, staffName: appointment.staffName, amountCents: line.priceCents ?? service.priceCents };
  });
}

/**
 * Record payment for a completed appointment. The bill's total comes from the resolved lines (never from the
 * client) and the payment allocations must add up to it exactly. Calling this again for an appointment that is
 * already paid returns the existing receipt instead of creating another.
 */
export async function recordPayment(ctx: TenantContext, input: RecordPaymentInput, now = new Date()): Promise<{ invoiceId: string; created: boolean; customerId: string | null }> {
  repo.assertWritable();
  const appointment = await appointmentsService.findAppointment(ctx.tenantId, input.appointmentId);
  if (!appointment) throw new AppError("NOT_FOUND", "Appointment not found.");

  const existing = (await repo.invoiceIdsByAppointment(ctx.tenantId, [appointment.id])).get(appointment.id);
  if (existing) return { invoiceId: existing, created: false, customerId: appointment.customerId };
  if (appointment.status !== "completed") throw new AppError("CONFLICT", "Complete the service before taking payment.");

  const tenant = await tenantsService.getTenant(ctx.tenantId);
  const lines = await resolveLines(ctx, appointment, input);
  const subtotal = lines.reduce((sum, l) => sum + l.amountCents, 0);
  if (subtotal <= 0) throw validation("lines", "The bill total must be above zero to take payment");

  // Each tip goes to an active team member at the appointment's branch and is paid on top of the services. Names
  // come from our own records, never the client. One person may appear on several rows.
  let tips: { amountCents: number; staffId: string; staffName: string }[] = [];
  if (input.tips.length) {
    const recipients = new Map((await tipRecipients(ctx.tenantId, appointment.branchId)).map((s) => [s.id, s.name]));
    tips = input.tips.map((tip) => {
      const staffName = recipients.get(tip.staffId);
      if (!staffName) throw validation("tips", "Choose an active team member at this branch for every tip");
      return { amountCents: tip.amountCents, staffId: tip.staffId, staffName };
    });
  }
  const tipTotal = tips.reduce((sum, t) => sum + t.amountCents, 0);
  const total = subtotal + tipTotal;
  const paid = input.payments.reduce((sum, p) => sum + p.amountCents, 0);
  if (paid !== total) {
    const difference = formatMoney(Math.abs(total - paid), tenant.currency);
    throw validation("payments", `Payments add up to ${formatMoney(paid, tenant.currency)} but the bill is ${formatMoney(total, tenant.currency)} (${difference} ${paid < total ? "short" : "over"})`);
  }

  const result = await repo.createPaidInvoice(ctx.tenantId, {
    appointmentId: appointment.id,
    branchId: appointment.branchId,
    customerId: appointment.customerId,
    customerName: appointment.customerName,
    currency: tenant.currency,
    paidAt: now,
    lines,
    tips,
    payments: input.payments,
  });
  return { invoiceId: result.id, created: result.ok, customerId: appointment.customerId };
}

// --- Receipt -------------------------------------------------------------------------------------------

/** A receipt exists only for a recorded payment: no invoice row, no receipt (NOT_FOUND). */
export async function getReceipt(ctx: TenantContext, invoiceId: string): Promise<ReceiptView> {
  const invoice = await repo.findInvoice(ctx.tenantId, invoiceId);
  if (!invoice) throw new AppError("NOT_FOUND", "Receipt not found.");
  const [tenant, branch] = await Promise.all([tenantsService.getTenant(ctx.tenantId), branchesService.getBranch(ctx.tenantId, invoice.branchId)]);
  return {
    id: invoice.id,
    receiptNumber: invoice.receiptNumber,
    status: "paid",
    paidAt: invoice.paidAt,
    currency: invoice.currency,
    timezone: tenant.timezone,
    tenantName: tenant.name,
    branch: { name: branch.name, addressLine: branch.addressLine, city: branch.city, phone: branch.phone ?? null },
    customer: { id: invoice.customerId, name: invoice.customerName },
    appointmentId: invoice.appointmentId,
    lines: invoice.lines,
    payments: invoice.payments,
    subtotalCents: invoice.subtotalCents,
    tipCents: invoice.tipCents,
    tips: invoice.tips,
    totalCents: invoice.totalCents,
  };
}
