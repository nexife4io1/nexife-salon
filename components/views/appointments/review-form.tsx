"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { submitReviewAction } from "@/server/appointments/actions";
import { MAX_RATING, REVIEW_COMMENT_MAX, type PublicReview } from "@/server/appointments/schema";

const WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

/** 1-5 stars as a radio group: arrow keys, a visible focus ring, and a spoken label ("3 of 5 stars, Good") per star. */
function StarRating({ name, label, hint, required, error }: { name: string; label: string; hint?: string; required?: boolean; error?: string }) {
  const [value, setValue] = useState(0);
  const errorId = useId();
  return (
    <fieldset className="min-w-0" aria-describedby={error ? errorId : undefined}>
      <legend className="text-body-md font-medium text-on-surface">
        {label}
        {required && <span className="sr-only"> (required)</span>}
      </legend>
      {hint && <p className="text-label-sm text-secondary">{hint}</p>}
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              required={required}
              checked={value === n}
              onChange={() => setValue(n)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {n} of {MAX_RATING} stars, {WORDS[n - 1]}
            </span>
            <span
              aria-hidden
              className={cn(
                "grid size-11 place-items-center rounded-full text-3xl leading-none transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container",
                n <= value ? "text-primary" : "text-outline-variant",
              )}
            >
              ★
            </span>
          </label>
        ))}
        <span className="ml-2 min-w-20 text-label-md text-secondary" aria-hidden>
          {value ? WORDS[value - 1] : ""}
        </span>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-label-sm text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** The public review form. Rendered only for an open link; it shows services and team members, nothing about the customer. */
export function ReviewForm({ token, review }: { token: string; review: Extract<PublicReview, { state: "open" }> }) {
  const [state, action, pending] = useActionState(submitReviewAction, undefined);
  const [comment, setComment] = useState("");
  const errors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formError = state && !state.ok && state.error.code !== "VALIDATION" ? state.error.message : undefined;
  const firstError = (key: string) => errors?.[key]?.[0];

  if (state?.ok) {
    return (
      <div role="status" className="rounded-card border border-outline-variant/15 bg-surface-container-lowest p-8 text-center shadow-card">
        <p className="font-headline text-headline-sm font-semibold text-on-surface">Thank you for your feedback</p>
        <p className="mt-2 text-body-sm text-secondary">Your review has been sent. You can close this page.</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-8 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-card sm:p-8" aria-busy={pending}>
      <input type="hidden" name="token" value={token} />

      <StarRating name="salon" label="How was the salon overall?" required error={firstError("salonRating")} />

      {review.services.length > 0 && (
        <section aria-labelledby="rate-services" className="space-y-6">
          <h2 id="rate-services" className="eyebrow">
            Services (optional)
          </h2>
          {review.services.map((service) => (
            <StarRating key={service.id} name={`service:${service.id}`} label={service.name} error={firstError(`serviceRatings.${service.id}`)} />
          ))}
        </section>
      )}

      {review.staff.length > 0 && (
        <section aria-labelledby="rate-team" className="space-y-6">
          <h2 id="rate-team" className="eyebrow">
            Your team (optional)
          </h2>
          {review.staff.map((member) => (
            <StarRating key={member.id} name={`staff:${member.id}`} label={member.name} hint={member.serviceNames.join(", ")} error={firstError(`staffRatings.${member.id}`)} />
          ))}
        </section>
      )}

      <div>
        <label htmlFor="review-comment" className="text-body-md font-medium text-on-surface">
          Anything else you&apos;d like to tell us? <span className="text-secondary">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          name="comment"
          rows={4}
          maxLength={REVIEW_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-describedby="review-comment-hint"
          className="mt-2 w-full rounded-control border-[1.5px] border-transparent bg-surface-container-low px-4 py-3 text-body-sm text-on-surface focus:border-primary-container focus:bg-surface-container-lowest focus:outline-none"
        />
        <p id="review-comment-hint" className="mt-1 text-label-sm text-secondary">
          Please don&apos;t include personal details such as phone numbers. {comment.length}/{REVIEW_COMMENT_MAX}
        </p>
        {firstError("comment") && (
          <p role="alert" className="mt-1 text-label-sm text-error">
            {firstError("comment")}
          </p>
        )}
      </div>

      <div aria-live="polite">
        {formError ? (
          <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
            {formError}
          </p>
        ) : errors ? (
          <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
            Please fix the highlighted ratings and try again. Your review has not been sent.
          </p>
        ) : null}
      </div>

      <Button type="submit" fullWidth disabled={pending}>
        {pending ? "Sending…" : "Send review"}
      </Button>
    </form>
  );
}
