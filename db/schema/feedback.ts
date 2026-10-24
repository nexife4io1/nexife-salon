import { check, index, integer, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, salon } from "./_shared";
import { appointments, appointmentServices, staff } from "./operations";
import { tenants } from "./tenancy";

/**
 * Customer feedback collected from the QR code on a receipt.
 *
 * `review_requests` is one row per appointment: the public link points at it (the link itself is a signed token
 * derived from `nonce`, so no secret is stored). `reviews` holds the single submission a request accepts, and
 * `review_ratings` the per-service and per-staff scores. Names are snapshotted so history survives later edits.
 */
export const reviewRequests = salon.table(
  "review_requests",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    nonce: text("nonce").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("review_requests_appointment_uq").on(t.tenantId, t.appointmentId),
    uniqueIndex("review_requests_nonce_uq").on(t.nonce),
  ],
);

export const reviews = salon.table(
  "reviews",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => reviewRequests.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    salonRating: smallint("salon_rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_request_uq").on(t.requestId),
    index("reviews_tenant_idx").on(t.tenantId, t.createdAt),
    check("reviews_salon_rating_chk", sql`${t.salonRating} between 1 and 5`),
    check("reviews_comment_chk", sql`${t.comment} is null or char_length(${t.comment}) <= 1000`),
  ],
);

export const reviewRatings = salon.table(
  "review_ratings",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    serviceLineId: uuid("service_line_id").references(() => appointmentServices.id, { onDelete: "set null" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    rating: integer("rating").notNull(),
  },
  (t) => [
    index("review_ratings_review_idx").on(t.reviewId),
    index("review_ratings_staff_idx").on(t.tenantId, t.staffId),
    check("review_ratings_kind_chk", sql`${t.kind} in ('service', 'staff')`),
    check("review_ratings_rating_chk", sql`${t.rating} between 1 and 5`),
  ],
);
