import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CheckoutForm } from "@/components/views/billing/checkout-form";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { getCheckoutView } from "@/server/billing/queries";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const view = await getCheckoutView(appointmentId);

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <ButtonLink href="/appointments" variant="ghost" size="sm" icon="arrow-left" className="mb-4 -ml-3">
          Back to Appointments
        </ButtonLink>
        <PageHeader title="Checkout" description="Review the bill and record the payment." meta={<DemoDataBadge source={view.source} />} />
      </div>
      {view.state === "ready" ? (
        // Keyed so a different appointment never inherits another bill's edits.
        <CheckoutForm key={view.appointment.id} view={view} />
      ) : (
        <Card className="mx-auto max-w-5xl">
          {view.state === "paid" && view.receiptId ? (
            <EmptyState
              icon="receipt"
              title="This appointment is already paid"
              description="A payment has been recorded, so the receipt is available."
              action={<ButtonLink href={`/billing/receipts/${view.receiptId}`}>View receipt</ButtonLink>}
            />
          ) : (
            <EmptyState
              icon="clock"
              title="The service isn't completed yet"
              description="Mark the appointment as completed on the schedule, then come back to take payment."
              action={<ButtonLink href="/appointments">Go to Appointments</ButtonLink>}
            />
          )}
        </Card>
      )}
    </>
  );
}
