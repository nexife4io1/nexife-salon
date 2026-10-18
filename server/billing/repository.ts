import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { DatabaseNotConfiguredError, isDatabaseConfigured, withTenant } from "@/db/client";
import { invoiceCounters, invoiceLines, invoices, payments } from "@/db/schema";
import { fixtureBranchActivity, fixtureBranches } from "@/db/seed/fixtures";
import { PAYMENT_METHODS, type InvoiceSummary, type Payment, type PaymentMethod } from "./schema";

/** Writes always need a real database; call first so demo mode fails before any other work. */
export function assertWritable(): void {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
}

export function dataSource(): "database" | "demo" {
  return isDatabaseConfigured() ? "database" : "demo";
}

export async function sumByBranchBetween(tenantId: string, start: Date, end: Date): Promise<Map<string, number>> {
  if (!isDatabaseConfigured()) {
    return new Map(
      fixtureBranches.filter((b) => b.tenantId === tenantId).map((b) => [b.id, fixtureBranchActivity[b.id]?.revenueTodayCents ?? 0]),
    );
  }
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ branchId: payments.branchId, total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), gte(payments.paidAt, start), lt(payments.paidAt, end)))
      .groupBy(payments.branchId),
  );
  return new Map(rows.map((r) => [r.branchId, r.total]));
}

export async function listRecent(tenantId: string, limit = 20): Promise<Payment[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({
        id: payments.id,
        branchId: payments.branchId,
        appointmentId: payments.appointmentId,
        invoiceId: payments.invoiceId,
        receiptNumber: invoices.receiptNumber,
        amountCents: payments.amountCents,
        method: payments.method,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.paidAt), desc(payments.createdAt))
      .limit(limit),
  );
}

/** Number of bills and their total in [start, end): drives the "average ticket" tile. */
export async function invoiceStatsBetween(tenantId: string, start: Date, end: Date): Promise<{ count: number; totalCents: number }> {
  if (!isDatabaseConfigured()) return { count: 0, totalCents: 0 };
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select({ n: count(), total: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int` })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), gte(invoices.paidAt, start), lt(invoices.paidAt, end))),
  );
  return { count: row?.n ?? 0, totalCents: row?.total ?? 0 };
}

// --- Invoices & receipts -------------------------------------------------------------------------------

export type InvoiceRecord = {
  id: string;
  branchId: string;
  appointmentId: string | null;
  customerId: string | null;
  customerName: string | null;
  receiptNumber: string;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  paidAt: Date;
  lines: { id: string; name: string; staffName: string | null; amountCents: number }[];
  payments: { id: string; method: PaymentMethod; amountCents: number }[];
};

export async function findInvoice(tenantId: string, invoiceId: string): Promise<InvoiceRecord | null> {
  if (!isDatabaseConfigured()) return null;
  return withTenant(tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
      .limit(1);
    if (!invoice) return null;
    const [lines, paid] = await Promise.all([
      tx
        .select({ id: invoiceLines.id, name: invoiceLines.name, staffName: invoiceLines.staffName, amountCents: invoiceLines.amountCents })
        .from(invoiceLines)
        .where(and(eq(invoiceLines.tenantId, tenantId), eq(invoiceLines.invoiceId, invoiceId)))
        .orderBy(asc(invoiceLines.position)),
      tx
        .select({ id: payments.id, method: payments.method, amountCents: payments.amountCents })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.invoiceId, invoiceId))),
    ]);
    return {
      id: invoice.id,
      branchId: invoice.branchId,
      appointmentId: invoice.appointmentId,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      receiptNumber: invoice.receiptNumber,
      currency: invoice.currency,
      subtotalCents: invoice.subtotalCents,
      totalCents: invoice.totalCents,
      paidAt: invoice.paidAt,
      lines,
      // Rows written together share a timestamp, so show them in a fixed order: by method, then largest first.
      payments: paid.sort((a, b) => PAYMENT_METHODS.indexOf(a.method) - PAYMENT_METHODS.indexOf(b.method) || b.amountCents - a.amountCents || a.id.localeCompare(b.id)),
    };
  });
}

/** appointment id -> invoice id, for the given appointments that have been paid. */
export async function invoiceIdsByAppointment(tenantId: string, appointmentIds: string[]): Promise<Map<string, string>> {
  if (!isDatabaseConfigured() || !appointmentIds.length) return new Map();
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ appointmentId: invoices.appointmentId, id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.appointmentId, appointmentIds))),
  );
  return new Map(rows.flatMap((r) => (r.appointmentId ? [[r.appointmentId, r.id] as const] : [])));
}

async function summaries(tenantId: string, where: ReturnType<typeof and>, limit: number): Promise<InvoiceSummary[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: invoices.id,
        receiptNumber: invoices.receiptNumber,
        appointmentId: invoices.appointmentId,
        customerName: invoices.customerName,
        totalCents: invoices.totalCents,
        paidAt: invoices.paidAt,
      })
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.paidAt), desc(invoices.createdAt))
      .limit(limit);
    const methods = rows.length
      ? await tx
          .select({ invoiceId: payments.invoiceId, method: payments.method })
          .from(payments)
          .where(and(eq(payments.tenantId, tenantId), inArray(payments.invoiceId, rows.map((r) => r.id))))
      : [];
    return rows.map((row) => ({
      ...row,
      methods: [...new Set(methods.filter((m) => m.invoiceId === row.id).map((m) => m.method))],
    }));
  });
}

export async function listInvoicesForCustomer(tenantId: string, customerId: string, limit: number): Promise<InvoiceSummary[]> {
  if (!isDatabaseConfigured()) return [];
  return summaries(tenantId, and(eq(invoices.tenantId, tenantId), eq(invoices.customerId, customerId)), limit);
}

/** All-time bill count and spend for one customer (not limited to the page of receipts shown). */
export async function customerTotals(tenantId: string, customerId: string): Promise<{ count: number; totalCents: number }> {
  if (!isDatabaseConfigured()) return { count: 0, totalCents: 0 };
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select({ n: count(), total: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int` })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.customerId, customerId))),
  );
  return { count: row?.n ?? 0, totalCents: row?.total ?? 0 };
}

export type NewInvoice = {
  appointmentId: string;
  branchId: string;
  customerId: string | null;
  customerName: string | null;
  currency: string;
  paidAt: Date;
  lines: { serviceId: string | null; kind: "catalog" | "custom"; name: string; staffName: string | null; amountCents: number }[];
  payments: { method: PaymentMethod; amountCents: number }[];
};

export type CreateInvoiceResult = { ok: true; id: string; receiptNumber: string } | { ok: false; reason: "already_paid"; id: string };

/** "NX-2026-00482": tenant-wide running number, prefixed with the payment year. */
export function formatReceiptNumber(paidAt: Date, sequence: number): string {
  return `NX-${paidAt.getUTCFullYear()}-${String(sequence).padStart(5, "0")}`;
}

/**
 * Record a bill and its payments atomically: invoice, lines, payment ledger rows and the receipt number all
 * commit together or not at all. A per-appointment advisory lock serialises concurrent submits, and the unique
 * index on (tenant, appointment) is the backstop, so a retry or double click gets the existing invoice back
 * instead of a second receipt.
 */
export async function createPaidInvoice(tenantId: string, input: NewInvoice): Promise<CreateInvoiceResult> {
  assertWritable();
  const total = input.lines.reduce((sum, line) => sum + line.amountCents, 0);
  const paid = input.payments.reduce((sum, p) => sum + p.amountCents, 0);
  if (!input.lines.length || total <= 0 || paid !== total) throw new Error("Invoice lines and payments must reconcile before they are written.");

  return withTenant(tenantId, async (tx): Promise<CreateInvoiceResult> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`invoice:${input.appointmentId}`}, 0))`);

    const [existing] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.appointmentId, input.appointmentId)))
      .limit(1);
    if (existing) return { ok: false, reason: "already_paid", id: existing.id };

    const [counter] = await tx
      .insert(invoiceCounters)
      .values({ tenantId, lastNumber: 1 })
      .onConflictDoUpdate({ target: invoiceCounters.tenantId, set: { lastNumber: sql`${invoiceCounters.lastNumber} + 1` } })
      .returning({ n: invoiceCounters.lastNumber });
    const receiptNumber = formatReceiptNumber(input.paidAt, counter!.n);

    const [invoice] = await tx
      .insert(invoices)
      .values({
        tenantId,
        branchId: input.branchId,
        appointmentId: input.appointmentId,
        customerId: input.customerId,
        customerName: input.customerName,
        receiptNumber,
        currency: input.currency,
        subtotalCents: total,
        totalCents: total,
        paidAt: input.paidAt,
      })
      .returning({ id: invoices.id });

    await tx.insert(invoiceLines).values(
      input.lines.map((line, position) => ({
        tenantId,
        invoiceId: invoice!.id,
        serviceId: line.serviceId,
        kind: line.kind,
        name: line.name,
        staffName: line.staffName,
        amountCents: line.amountCents,
        position,
      })),
    );
    await tx.insert(payments).values(
      input.payments.map((p) => ({
        tenantId,
        branchId: input.branchId,
        appointmentId: input.appointmentId,
        invoiceId: invoice!.id,
        amountCents: p.amountCents,
        method: p.method,
        paidAt: input.paidAt,
      })),
    );
    return { ok: true, id: invoice!.id, receiptNumber };
  });
}
