import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type ReceiptView } from "@/server/billing/schema";

const dateFmt = (at: Date, timeZone: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(at);
const timeFmt = (at: Date, timeZone: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(at);

/** The receipt itself: plain, high-contrast and print-friendly (the shell chrome is hidden when printing). */
export function Receipt({ receipt }: { receipt: ReceiptView }) {
  const money = (cents: number) => formatMoney(cents, receipt.currency);
  const methods = [...new Set(receipt.payments.map((p) => p.method))];
  const meta: [string, string][] = [
    ["Customer", receipt.customer.name ?? "Walk-in"],
    ["Receipt no.", receipt.receiptNumber],
    ["Date", dateFmt(receipt.paidAt, receipt.timezone)],
    ["Time", timeFmt(receipt.paidAt, receipt.timezone)],
    ["Method", methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(" + ")],
    ["Status", "Paid"],
  ];

  return (
    <article
      aria-label={`Receipt ${receipt.receiptNumber}`}
      className="mx-auto w-full max-w-2xl rounded-card border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-card md:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="mb-8 border-b border-outline-variant/20 pb-6 text-center">
        <p className="font-headline text-headline-md font-bold text-primary">{receipt.tenantName}</p>
        <p className="mt-1 text-body-sm text-secondary">
          {receipt.branch.name} · {receipt.branch.addressLine}
          {receipt.branch.city ? `, ${receipt.branch.city}` : ""}
          {receipt.branch.phone ? ` · ${receipt.branch.phone}` : ""}
        </p>
        <Badge tone="success" dot className="mt-4">
          Paid
        </Badge>
      </header>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        {meta.map(([label, value]) => (
          <div key={label}>
            <dt className="eyebrow mb-1">{label}</dt>
            <dd className="text-body-md text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="eyebrow mb-3">Services</h2>
      <ul className="divide-y divide-outline-variant/15 border-y border-outline-variant/15">
        {receipt.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="text-body-md font-medium text-on-surface">{line.name}</p>
              {line.staffName && <p className="text-label-sm text-secondary">Stylist: {line.staffName}</p>}
            </div>
            <p className="text-body-md text-on-surface">{money(line.amountCents)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 text-body-sm">
        <div className="flex justify-between">
          <dt className="text-secondary">Subtotal</dt>
          <dd className="text-on-surface">{money(receipt.subtotalCents)}</dd>
        </div>
        {receipt.tipCents > 0 && (
          <>
            <div className="flex justify-between">
              <dt className="font-medium text-on-surface">Total gratuity</dt>
              <dd className="font-medium text-on-surface">{money(receipt.tipCents)}</dd>
            </div>
            {receipt.tips.map((tip) => (
              <div key={tip.id} className="flex justify-between pl-4">
                <dt className="text-secondary">Tip for {tip.staffName}</dt>
                <dd className="text-on-surface">{money(tip.amountCents)}</dd>
              </div>
            ))}
          </>
        )}
        {receipt.payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <dt className="text-secondary">Paid by {PAYMENT_METHOD_LABELS[p.method]}</dt>
            <dd className="text-on-surface">{money(p.amountCents)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-4">
        <span className="text-label-md text-secondary">Total paid</span>
        <span className="font-headline text-headline-md font-semibold text-on-surface">{money(receipt.totalCents)}</span>
      </div>
    </article>
  );
}
