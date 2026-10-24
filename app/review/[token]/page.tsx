import type { Metadata } from "next";
import { ReviewForm } from "@/components/views/appointments/review-form";
import { getPublicReview } from "@/server/appointments/queries";

// A private link: keep it out of search results and don't leak it through the Referer header.
export const metadata: Metadata = { title: "Rate your visit", robots: { index: false, follow: false }, referrer: "no-referrer" };

const MESSAGES = {
  invalid: { title: "This link isn't valid", body: "Check that you scanned the whole code, or ask the salon for your receipt again." },
  expired: { title: "This review link has expired", body: "Review links work for a limited time after your visit." },
  submitted: { title: "Thank you", body: "We've already received a review for this visit." },
} as const;

/** Public page (no login): the signed token in the URL is the only credential. It shows services and team, nothing else. */
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = await getPublicReview(decodeURIComponent(token));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-8 sm:py-12">
      <h1 className="mb-2 font-headline text-headline-md font-bold text-on-surface">Rate your visit</h1>
      {review.state === "open" ? (
        <>
          <p className="mb-6 text-body-sm text-secondary">Thanks for visiting. It takes under a minute, and you don&apos;t need an account.</p>
          <ReviewForm token={decodeURIComponent(token)} review={review} />
        </>
      ) : (
        <div role="status" className="rounded-card border border-outline-variant/15 bg-surface-container-lowest p-8 text-center shadow-card">
          <p className="font-headline text-headline-sm font-semibold text-on-surface">{MESSAGES[review.state].title}</p>
          <p className="mt-2 text-body-sm text-secondary">{MESSAGES[review.state].body}</p>
        </div>
      )}
    </main>
  );
}
