import { z } from "zod";

export const PAYMENT_METHODS = ["cash", "card", "upi", "wallet", "other"] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: "Cash", card: "Card", upi: "UPI", wallet: "Wallet", other: "Other" };

/** Limits that keep a single bill sane. All money is integer minor units (cents). */
export const MAX_CHECKOUT_LINES = 20;
export const MAX_PAYMENT_SPLITS = 5;
export const MAX_TIP_ROWS = 10;
export const MAX_LINE_CENTS = 10_000_000;
export const MAX_CUSTOM_NAME_LENGTH = 80;

export const paymentSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  /** Name on the bill; null for a bill without a customer (or a payment with no bill). */
  customerName: z.string().nullable(),
  appointmentId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  amountCents: z.number().int(),
  method: paymentMethodSchema,
  paidAt: z.date(),
});
export type Payment = z.infer<typeof paymentSchema>;

// --- Checkout input ---------------------------------------------------------------------------------

/**
 * A bill line as submitted. Catalog lines name the service: the server looks up its name and default price (the
 * appointment's booked snapshot, or the current catalog price for a service added at checkout). `priceCents` is
 * an optional price for this bill only, e.g. a discount or a negotiated price; it is written to the invoice line
 * and never to the service catalog. A one-off line carries its own name and price.
 */
export const checkoutLineInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("catalog"),
    serviceId: z.string().uuid("Choose a valid service"),
    priceCents: z.number({ error: "Enter a price" }).int("Enter a valid price").min(0, "Enter a valid price").max(MAX_LINE_CENTS, "That price is too high").optional(),
  }),
  z.object({
    kind: z.literal("custom"),
    name: z.string().trim().min(1, "Enter a name for the item").max(MAX_CUSTOM_NAME_LENGTH, `Keep the name under ${MAX_CUSTOM_NAME_LENGTH} characters`),
    priceCents: z
      .number({ error: "Enter a price" })
      .int("Enter a valid price")
      .min(1, "Enter a price above zero")
      .max(MAX_LINE_CENTS, "That price is too high"),
  }),
]);
export type CheckoutLineInput = z.infer<typeof checkoutLineInputSchema>;

export const paymentAllocationInputSchema = z.object({
  method: paymentMethodSchema,
  amountCents: z.number({ error: "Enter an amount" }).int("Enter a valid amount").min(1, "Enter an amount above zero").max(MAX_LINE_CENTS * MAX_CHECKOUT_LINES),
});
export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;

/** One tip allocation on top of the services, credited to one team member. A bill can carry several, even for the same person. */
export const tipInputSchema = z.object({
  amountCents: z.number({ error: "Enter a tip amount" }).int("Enter a valid tip amount").min(1, "Enter a tip above zero").max(MAX_LINE_CENTS, "That tip is too high"),
  staffId: z.string({ error: "Choose who the tip is for" }).uuid("Choose who the tip is for"),
});
export type TipInput = z.infer<typeof tipInputSchema>;

export const recordPaymentInputSchema = z.object({
  appointmentId: z.string().uuid("Appointment not found"),
  lines: z.array(checkoutLineInputSchema).min(1, "Add at least one service to bill").max(MAX_CHECKOUT_LINES, `A bill can have at most ${MAX_CHECKOUT_LINES} items`),
  tips: z.array(tipInputSchema).max(MAX_TIP_ROWS, `Add at most ${MAX_TIP_ROWS} tips`).default([]),
  payments: z
    .array(paymentAllocationInputSchema)
    .min(1, "Add a payment")
    .max(MAX_PAYMENT_SPLITS, `Split a payment into at most ${MAX_PAYMENT_SPLITS} parts`),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;

/** The checkout form posts its whole state as one JSON string; anything unparseable fails validation. */
export function parseCheckoutPayload(raw: unknown) {
  let json: unknown;
  try {
    json = typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch {
    json = undefined;
  }
  return recordPaymentInputSchema.safeParse(json);
}

export const invoiceIdSchema = z.string().uuid();

// --- View models -------------------------------------------------------------------------------------

export type CheckoutLine = {
  /** Stable React key and edit handle; not persisted. */
  key: string;
  kind: "catalog" | "custom";
  serviceId: string | null;
  name: string;
  priceCents: number;
};

export type CheckoutView = {
  /** ready = can be paid now; paid = a receipt already exists; not_ready = service isn't completed yet. */
  state: "ready" | "paid" | "not_ready";
  receiptId: string | null;
  appointment: {
    id: string;
    status: string;
    startsAt: Date;
    customerId: string | null;
    customerName: string | null;
    staffName: string | null;
    branchName: string;
  };
  /** Active team members at the appointment's branch, who a tip can be credited to. */
  staff: { id: string; name: string }[];
  /** The appointment's own stylist, if they're among `staff`: the sensible default for a new tip row. */
  defaultTipStaffId: string | null;
  currency: string;
  timezone: string;
  /** Every service booked on the appointment, prepopulated as bill lines. */
  lines: CheckoutLine[];
  /** Active services this branch offers, for adding to the bill. */
  catalog: { id: string; name: string; category: string | null; priceCents: number }[];
  source: "database" | "demo";
};

export type ReceiptView = {
  id: string;
  receiptNumber: string;
  /** Always "paid": a receipt exists only for a payment that was recorded. */
  status: "paid";
  paidAt: Date;
  currency: string;
  timezone: string;
  tenantName: string;
  branch: { name: string; addressLine: string; city: string | null; phone: string | null };
  customer: { id: string | null; name: string | null };
  appointmentId: string | null;
  lines: { id: string; name: string; staffName: string | null; amountCents: number }[];
  payments: { id: string; method: PaymentMethod; amountCents: number }[];
  subtotalCents: number;
  /** Total gratuity: the sum of `tips`; 0 when there was no tip. */
  tipCents: number;
  /** Who the gratuity went to, as named when it was paid. Invoices from before multi-staff tips yield one entry. */
  tips: { id: string; staffName: string; amountCents: number }[];
  /** Services plus tip: what was paid. */
  totalCents: number;
};

export type InvoiceSummary = {
  id: string;
  receiptNumber: string;
  appointmentId: string | null;
  customerName: string | null;
  totalCents: number;
  paidAt: Date;
  methods: PaymentMethod[];
};

export type CustomerBilling = {
  currency: string;
  timezone: string;
  /** Most recent receipts, newest first. */
  invoices: InvoiceSummary[];
  paidCount: number;
  lifetimeSpendCents: number;
};

export type OpenTicket = {
  appointmentId: string;
  customerName: string | null;
  serviceName: string | null;
  staffName: string | null;
  startsAt: Date;
  totalCents: number;
};

/** Billing history filter, from the URL. */
export type BillingFilters = { branchId?: string };

/** Tolerant: a junk value in the URL is dropped rather than raising. */
export function parseBillingFilters(raw: Record<string, string | string[] | undefined>): BillingFilters {
  const value = Array.isArray(raw.branchId) ? raw.branchId[0] : raw.branchId;
  return { branchId: value && z.string().uuid().safeParse(value).success ? value : undefined };
}

export type BillingOverview = {
  recent: Payment[];
  /** Branches the history can be filtered by. */
  branches: { id: string; name: string }[];
  filters: BillingFilters;
  openTickets: OpenTicket[];
  revenueTodayCents: number;
  averageTicketTodayCents: number | null;
  currency: string;
  timezone: string;
  source: "database" | "demo";
};
