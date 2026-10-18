import { z } from "zod";

export const PAYMENT_METHODS = ["cash", "card", "upi", "wallet", "other"] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: "Cash", card: "Card", upi: "UPI", wallet: "Wallet", other: "Other" };

/** Limits that keep a single bill sane. All money is integer minor units (cents). */
export const MAX_CHECKOUT_LINES = 20;
export const MAX_PAYMENT_SPLITS = 5;
export const MAX_LINE_CENTS = 10_000_000;
export const MAX_CUSTOM_NAME_LENGTH = 80;

export const paymentSchema = z.object({
  id: z.string(),
  branchId: z.string(),
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
 * A bill line as submitted. Catalog lines name only the service: the server looks up name and price (the
 * appointment's booked snapshot, or the current catalog price for a service added at checkout) so a client can
 * never choose a catalog price. A one-off line carries its own name and price and never touches the catalog.
 */
export const checkoutLineInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catalog"), serviceId: z.string().uuid("Choose a valid service") }),
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

export const recordPaymentInputSchema = z.object({
  appointmentId: z.string().uuid("Appointment not found"),
  lines: z.array(checkoutLineInputSchema).min(1, "Add at least one service to bill").max(MAX_CHECKOUT_LINES, `A bill can have at most ${MAX_CHECKOUT_LINES} items`),
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

export type BillingOverview = {
  recent: Payment[];
  openTickets: OpenTicket[];
  revenueTodayCents: number;
  averageTicketTodayCents: number | null;
  currency: string;
  timezone: string;
  source: "database" | "demo";
};
