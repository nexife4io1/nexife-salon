# Appointments: service lines and customer reviews

## Service lines (added in migration 0010)

An appointment keeps its own status (`booked → checked_in → in_service → completed`, plus `cancelled` / `no_show`).
Each booked service (`appointment_services`) now has a life of its own:

| Field                          | Meaning                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `status`                       | `pending → in_progress → completed`. Completed is final.                                      |
| `staff_id`                     | The team member responsible **now**. Reassignment changes this.                               |
| `performed_by_staff_id / _name`| Who was recorded as doing it **when it was completed**. Written once, never rewritten.        |
| `started_at`, `completed_at`   | When the work happened.                                                                       |

`appointment_service_events` is an append-only trail (added, removed, started, completed, reassigned, corrected) with
names snapshotted, who made the change, and a reason where one is required.

Rules (all enforced on the server, in one transaction, with the appointment row locked `FOR UPDATE`):

- **Add / remove / start / finish** a service: only while the appointment is `checked_in` or `in_service`.
  Added services must be active, offered by the appointment's branch, priced from the catalog, within
  `MAX_SERVICES_PER_APPOINTMENT`, and not already on the appointment. Only an untouched (`pending`) service can be
  removed, and never the last one.
- **Starting** a service needs a team member. The first start moves `checked_in` to `in_service`. Nothing a service
  does ever completes the appointment.
- **Complete** (the appointment button) still means "all the work is done": it closes every open service, recording
  whoever holds each as the performer, in the same transaction.
- **Reassign**: while the appointment is under way, a plain reassignment. After the service is completed, or the
  appointment is completed, it is a **correction** that needs a reason: `staff_id` changes, `performed_by_*` and
  `completed_at` do not, and the event records from, to, why and who. Cancelled, no-show and booked appointments are
  not reassignable (use Edit before check-in).
- The team member must be active, work at the appointment's branch, and (if they declared services) perform that service.
- When every service of an appointment is held by the same person, `appointments.staff_id` follows (board column,
  checkout default); in a shared visit it stays the lead.
- Issued invoices, receipts and payments are never touched. Their lines are snapshots.

Not enforced when adding mid-visit: the new service lengthens the appointment and may overlap the team member's next
booking (the schedule overlap guard applies when booking, not to work already under way).

## Customer reviews (QR on the receipt)

- `review_requests`: one per completed appointment, created the first time a receipt asks for a link. `reviews` holds
  the one submission a request accepts, `review_ratings` the per-service and per-team scores (labels snapshotted).
- **Link**: `/review/<token>` where the token is `base64url(tenant id + 128-bit nonce) . truncated HMAC-SHA256`
  (`review-token.ts`, keyed with `SESSION_SECRET`, domain-separated from session cookies). The tag is verified in constant
  time before any database access. It contains no appointment id, customer id or anything guessable; nothing secret is
  stored, so a reprinted receipt shows the same code. Set `APP_URL` (e.g. `https://app.example.com`) so QR codes never
  carry an internal host; otherwise the request host is used.
- **Eligibility**: the appointment is `completed`. **Validity**: 30 days from the moment the link is first issued
  (`REVIEW_LINK_TTL_DAYS`); after that the page says it expired and the receipt stops showing the code.
- **One review per visit, no edits**: the request row is locked while a review is stored, so a replay or double tap gets
  "already submitted" and the first review stands. (Editing is deliberately not offered: with no login there is no way
  to tell the customer from someone who found the receipt.)
- **Mapping**: the page lists each service of the visit and each distinct team member credited with them (one rating
  per person, even if they did several services; a corrected team member replaces the original). The salon rating is
  required; service and team ratings are optional. Ratings are integers 1-5, validated by the schema and by DB checks.
  Rating keys must belong to that visit or the submission is refused and nothing is stored.
- **Privacy**: the page shows only service names and team member names. No tenant, branch, customer, price, date or
  internal id. The comment is optional, at most 1000 characters; nothing else is collected.
- Stored feedback carries `tenant_id` with the standard `tenant_isolation` RLS policy; the public page resolves the
  tenant from the verified token and reads through `withTenant` like everything else.

## Customer picker

`components/views/appointments/customer-picker.tsx` is an ARIA combobox. The booking form preloads the 20 most recent
customers (`CUSTOMER_PICKER_LIMIT`); when the directory is larger (`customersTruncated`) typing searches the whole
directory through `searchCustomersAction` (which calls the customers service; no change to that module).
