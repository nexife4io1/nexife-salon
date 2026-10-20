import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PrintButton } from "@/components/views/billing/print-button";
import { Receipt } from "@/components/views/billing/receipt";
import { getReceiptView } from "@/server/billing/queries";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const receipt = await getReceiptView(invoiceId);

  return (
    <>
      <div className="mx-auto max-w-2xl print:hidden">
        <ButtonLink href="/billing" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Billing
        </ButtonLink>
        <PageHeader
          title="Payment recorded"
          description={`Receipt ${receipt.receiptNumber}`}
          actions={
            <>
              {receipt.customer.id && (
                <ButtonLink href={`/customers/${receipt.customer.id}`} variant="ghost">
                  Customer profile
                </ButtonLink>
              )}
              <PrintButton />
            </>
          }
        />
      </div>
      <Receipt receipt={receipt} />
    </>
  );
}
