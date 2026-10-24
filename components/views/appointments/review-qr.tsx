import { qrMatrix, qrPath } from "./qr";
import type { ReceiptReviewLinkView } from "@/server/appointments/schema";

const dateFmt = (at: Date, timeZone: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(at);

/**
 * The "rate your visit" block for the bottom of a receipt: a QR code to the public review page. Black on white with a
 * quiet zone so it scans from paper and from a screen. Renders nothing when there is no link to offer.
 * (Server component: the code is drawn as an inline SVG, no client JavaScript and no image request.)
 */
export function ReviewQr({ link, timezone = "UTC" }: { link: ReceiptReviewLinkView; timezone?: string }) {
  if (link.state === "submitted") {
    return <p className="mt-8 border-t border-outline-variant/20 pt-4 text-center text-label-sm text-secondary">Thanks, we&apos;ve received your review.</p>;
  }
  if (link.state !== "open") return null;
  const { viewBox, d } = qrPath(qrMatrix(link.url));
  return (
    <section aria-labelledby="review-qr-title" className="mt-8 flex flex-col items-center gap-2 border-t border-outline-variant/20 pt-6 text-center">
      <h2 id="review-qr-title" className="font-headline text-body-md font-semibold text-on-surface">
        How was your visit?
      </h2>
      <svg role="img" aria-label="QR code that opens the review page" viewBox={viewBox} className="size-40 bg-white" shapeRendering="crispEdges">
        <path d={d} fill="#000" />
      </svg>
      <p className="text-label-sm text-secondary">Scan to rate your services, your team and the salon. Valid until {dateFmt(link.expiresAt, timezone)}.</p>
    </section>
  );
}
