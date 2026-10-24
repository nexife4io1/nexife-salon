import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { type Fixture, type FixtureTenant } from "../support/appointments-fixture";

vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

let f: Fixture;
let tokens: typeof import("@/server/appointments/review-token");
let secret: string;
beforeAll(async () => {
  f = await (await import("../support/appointments-fixture")).loadFixture();
  tokens = await import("@/server/appointments/review-token");
  secret = (await import("@/server/shared/session-token")).getSessionSecret();
});

const T0 = new Date("2026-10-20T12:00:00Z");
const DAY = 24 * 60 * 60_000;

/** A completed appointment: Haircut + Color by Sam, Perm by Kim. */
async function completedVisit(t: FixtureTenant) {
  const sam = await t.member("Sam");
  const kim = await t.member("Kim");
  const { id } = await f.book(t, { staffId: sam });
  await f.toStatus(t, id, "checked_in", "in_service");
  await f.appts.addServiceLine(t.ctx, { appointmentId: id, serviceId: t.service("Color") });
  await f.appts.addServiceLine(t.ctx, { appointmentId: id, serviceId: t.service("Perm"), staffId: kim });
  await f.toStatus(t, id, "completed");
  return { id, sam, kim };
}
const linkFor = async (t: FixtureTenant, id: string, now = T0) => {
  const link = await f.appts.getReceiptReviewLink(t.ctx, id, now);
  if (link.state !== "open") throw new Error(`expected an open link, got ${link.state}`);
  return link;
};
const open = async (token: string, now = T0) => {
  const view = await f.appts.getPublicReview(token, now);
  if (view.state !== "open") throw new Error(`expected an open review, got ${view.state}`);
  return view;
};
const input = (token: string, over: Record<string, unknown> = {}) => f.schema.submitReviewInputSchema.parse({ token, salonRating: 5, ...over });

describe("review links", () => {
  it("are issued only for completed appointments and are stable across receipt views", async () => {
    const t = await f.newTenant("rl1");
    const sam = await t.member("Sam");
    const { id } = await f.book(t, { staffId: sam });
    expect(await f.appts.getReceiptReviewLink(t.ctx, id, T0)).toEqual({ state: "unavailable" }); // booked
    await f.toStatus(t, id, "checked_in", "in_service");
    expect(await f.appts.getReceiptReviewLink(t.ctx, id, T0)).toEqual({ state: "unavailable" }); // in service
    await f.toStatus(t, id, "completed");

    const first = await linkFor(t, id);
    const second = await linkFor(t, id, new Date(T0.getTime() + DAY));
    expect(second.token).toBe(first.token); // a reprinted receipt carries the same code
    expect(first.expiresAt.getTime()).toBe(T0.getTime() + f.schema.REVIEW_LINK_TTL_DAYS * DAY);
    expect(first.token).not.toContain(id); // no internal id in the URL
  });

  it("cannot be issued for another tenant's appointment or a missing one", async () => {
    const a = await f.newTenant("rl2a");
    const b = await f.newTenant("rl2b");
    const { id } = await completedVisit(a);
    expect(await f.appts.getReceiptReviewLink(b.ctx, id, T0)).toEqual({ state: "unavailable" });
    expect(await f.appts.getReceiptReviewLink(a.ctx, "7d3c9f62-1d0a-4e1b-9a55-ffffffffffff", T0)).toEqual({ state: "unavailable" });
  });

  it("converge on one request when issued concurrently", async () => {
    const t = await f.newTenant("rl3");
    const { id } = await completedVisit(t);
    const links = await Promise.all([1, 2, 3, 4].map(() => linkFor(t, id)));
    expect(new Set(links.map((l) => l.token)).size).toBe(1);
    expect(await f.db.select().from(f.tables.reviewRequests).where(eq(f.tables.reviewRequests.tenantId, t.id))).toHaveLength(1);
  });

  it("expire after the validity window", async () => {
    const t = await f.newTenant("rl4");
    const { id } = await completedVisit(t);
    const { token } = await linkFor(t, id);
    const justBefore = new Date(T0.getTime() + f.schema.REVIEW_LINK_TTL_DAYS * DAY - 1_000);
    const after = new Date(T0.getTime() + f.schema.REVIEW_LINK_TTL_DAYS * DAY);
    await open(token, justBefore);
    expect(await f.appts.getPublicReview(token, after)).toEqual({ state: "expired" });
    expect(await f.appts.submitReview(input(token), after)).toEqual({ ok: false, state: "expired" });
    expect(await f.appts.getReceiptReviewLink(t.ctx, id, after)).toEqual({ state: "expired" });
    expect(await f.db.select().from(f.tables.reviews).where(eq(f.tables.reviews.tenantId, t.id))).toHaveLength(0);
  });
});

describe("the public review page", () => {
  it("maps a multi-service, multi-staff visit to one rating per service and one per team member", async () => {
    const t = await f.newTenant("pg1");
    const { id, sam, kim } = await completedVisit(t);
    const view = await open((await linkFor(t, id)).token);

    expect(view.services.map((s) => s.name)).toEqual(["Haircut", "Color", "Perm"]);
    expect(view.staff).toEqual([
      { id: sam, name: "Sam", serviceNames: ["Haircut", "Color"] }, // one rating covers both of Sam's services
      { id: kim, name: "Kim", serviceNames: ["Perm"] },
    ]);
  });

  it("exposes nothing about the tenant, the customer, money, dates or internal appointment ids", async () => {
    const t = await f.newTenant("pg2");
    const { id } = await completedVisit(t);
    const view = await open((await linkFor(t, id)).token);
    const json = JSON.stringify(view);
    for (const secretValue of [id, t.id, t.branchId, t.customerId, "Cara Customer", "Salon pg2", "+15550001111", "1000", "USD", "2026-10-20"]) {
      expect(json).not.toContain(secretValue);
    }
  });

  it("credits a corrected team member, not the one first recorded", async () => {
    const t = await f.newTenant("pg3");
    const { id, sam, kim } = await completedVisit(t);
    const [haircut] = await f.lines(t, id);
    await f.appts.reassignServiceLine(t.ctx, { appointmentId: id, lineId: haircut!.id, staffId: kim, reason: "Kim did this one" });
    const view = await open((await linkFor(t, id)).token);
    expect(view.staff.map((s) => [s.name, s.serviceNames])).toEqual([["Kim", ["Haircut", "Perm"]], ["Sam", ["Color"]]]); // in order of first service
    expect(sam).not.toBe(kim);
  });

  it("treats malformed, tampered, foreign and unissued links all as invalid", async () => {
    const a = await f.newTenant("pg4a");
    const b = await f.newTenant("pg4b");
    const { id } = await completedVisit(a);
    const { token } = await linkFor(a, id);
    const [payload, tag] = token.split(".") as [string, string];
    const nonceOf = tokens.verifyReviewToken(token, secret)!.nonce;

    const invalid = [
      "",
      "garbage",
      "a.b.c",
      token + "x",
      `${payload}.${tag.slice(0, -2)}AA`, // tampered tag
      `${payload.slice(0, -2)}AA.${tag}`, // tampered payload
      tokens.signReviewToken(a.id, tokens.newReviewNonce(), secret), // genuine signature, but no such request
      tokens.signReviewToken(b.id, nonceOf, secret), // the right nonce under another tenant: RLS/tenant scope hides it
      tokens.signReviewToken(a.id, nonceOf, "another-secret-another-secret-0123456789"), // signed by someone else
    ];
    for (const bad of invalid) {
      expect(await f.appts.getPublicReview(bad, T0)).toEqual({ state: "invalid" });
      expect(await f.appts.submitReview(input(bad.slice(0, 190) || "x"), T0)).toEqual({ ok: false, state: "invalid" });
    }
    expect(await f.db.select().from(f.tables.reviews)).not.toContainEqual(expect.objectContaining({ appointmentId: id }));
  });
});

describe("submitting a review", () => {
  it("stores the salon, service and team ratings with a comment, for the right tenant", async () => {
    const t = await f.newTenant("sub1");
    const other = await f.newTenant("sub1b");
    const { id, sam, kim } = await completedVisit(t);
    const { token } = await linkFor(t, id);
    const view = await open(token);

    const result = await f.appts.submitReview(
      input(token, {
        salonRating: 4,
        serviceRatings: { [view.services[0]!.id]: 5, [view.services[2]!.id]: 2 },
        staffRatings: { [sam]: 5, [kim]: 3 },
        comment: "  Lovely  ",
      }),
      T0,
    );
    expect(result).toEqual({ ok: true });

    const [review] = await f.db.select().from(f.tables.reviews).where(eq(f.tables.reviews.tenantId, t.id));
    expect(review).toMatchObject({ appointmentId: id, salonRating: 4, comment: "Lovely", tenantId: t.id });
    const ratings = await f.db.select().from(f.tables.reviewRatings).where(eq(f.tables.reviewRatings.reviewId, review!.id));
    expect(ratings.map((r) => [r.kind, r.label, r.rating, r.tenantId === t.id]).sort()).toEqual([
      ["service", "Haircut", 5, true],
      ["service", "Perm", 2, true],
      ["staff", "Kim", 3, true],
      ["staff", "Sam", 5, true],
    ]);
    // Tenant isolation: the other tenant has no feedback at all.
    expect(await f.db.select().from(f.tables.reviews).where(eq(f.tables.reviews.tenantId, other.id))).toEqual([]);
    expect(await f.db.select().from(f.tables.reviewRatings).where(eq(f.tables.reviewRatings.tenantId, other.id))).toEqual([]);
  });

  it("accepts a salon rating alone (service and team ratings and the comment are optional)", async () => {
    const t = await f.newTenant("sub2");
    const { id } = await completedVisit(t);
    const { token } = await linkFor(t, id);
    expect(await f.appts.submitReview(input(token, { salonRating: 1 }), T0)).toEqual({ ok: true });
    const [review] = await f.db.select().from(f.tables.reviews).where(eq(f.tables.reviews.tenantId, t.id));
    expect(review).toMatchObject({ salonRating: 1, comment: null });
  });

  it("refuses a second submission for the same link (replay) and says so", async () => {
    const t = await f.newTenant("sub3");
    const { id } = await completedVisit(t);
    const { token } = await linkFor(t, id);
    expect(await f.appts.submitReview(input(token, { salonRating: 5 }), T0)).toEqual({ ok: true });
    expect(await f.appts.submitReview(input(token, { salonRating: 1, comment: "changed my mind" }), T0)).toEqual({ ok: false, state: "submitted" });
    expect(await f.appts.getPublicReview(token, T0)).toEqual({ state: "submitted" });
    expect(await f.appts.getReceiptReviewLink(t.ctx, id, T0)).toEqual({ state: "submitted" });
    const rows = await f.db.select().from(f.tables.reviews).where(eq(f.tables.reviews.tenantId, t.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.salonRating).toBe(5); // the first review stands, untouched
  });

  it("accepts exactly one of several simultaneous submissions", async () => {
    const t = await f.newTenant("sub4");
    const { id } = await completedVisit(t);
    const { token } = await linkFor(t, id);
    const results = await Promise.all([5, 4, 3, 2, 1].map((salonRating) => f.appts.submitReview(input(token, { salonRating }), T0)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.state === "submitted")).toBe(true);
    expect(await f.db.select().from(f.tables.reviews).where(eq(f.tables.reviews.tenantId, t.id))).toHaveLength(1);
  });

  it("rejects ratings for services or people that are not part of the visit, and stores nothing", async () => {
    const a = await f.newTenant("sub5a");
    const b = await f.newTenant("sub5b");
    const { id } = await completedVisit(a);
    const other = await completedVisit(b);
    const { token } = await linkFor(a, id);
    const foreignLine = (await f.lines(b, other.id))[0]!.id;

    for (const bad of [
      { serviceRatings: { [foreignLine]: 5 } },
      { staffRatings: { [other.sam]: 5 } },
      { serviceRatings: { "7d3c9f62-1d0a-4e1b-9a55-ffffffffffff": 5 } },
    ]) {
      expect(await f.appts.submitReview(input(token, bad), T0)).toEqual({ ok: false, state: "invalid" });
    }
    expect(await f.db.select().from(f.tables.reviews).where(eq(f.tables.reviews.tenantId, a.id))).toHaveLength(0);
    await open(token); // the link is still usable after rejected attempts
  });

  it("keeps the ratings as written when the team is changed afterwards", async () => {
    const t = await f.newTenant("sub6");
    const { id, sam, kim } = await completedVisit(t);
    const { token } = await linkFor(t, id);
    await f.appts.submitReview(input(token, { staffRatings: { [sam]: 5 } }), T0);
    const [haircut] = await f.lines(t, id);
    await f.appts.reassignServiceLine(t.ctx, { appointmentId: id, lineId: haircut!.id, staffId: kim, reason: "Correction after the review" });
    const rows = await f.db.select().from(f.tables.reviewRatings).where(eq(f.tables.reviewRatings.tenantId, t.id));
    expect(rows.map((r) => [r.label, r.rating])).toEqual([["Sam", 5]]);
  });
});

describe("rating validation", () => {
  const ok = { token: "t", salonRating: 3 };
  const parse = (over: Record<string, unknown>) => f.schema.submitReviewInputSchema.safeParse({ ...ok, ...over });
  const line = "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01";

  it("requires a whole salon rating from 1 to 5", () => {
    expect(parse({}).success).toBe(true);
    for (const bad of [0, 6, -1, 2.5, "3", null, undefined, Number.NaN, Infinity]) expect(parse({ salonRating: bad }).success, String(bad)).toBe(false);
    for (const good of [1, 2, 3, 4, 5]) expect(parse({ salonRating: good }).success).toBe(true);
  });

  it("validates service and team ratings the same way and only accepts id keys", () => {
    expect(parse({ serviceRatings: { [line]: 5 }, staffRatings: { [line]: 1 } }).success).toBe(true);
    for (const bad of [0, 6, 1.5, "5"]) {
      expect(parse({ serviceRatings: { [line]: bad } }).success, `service ${bad}`).toBe(false);
      expect(parse({ staffRatings: { [line]: bad } }).success, `staff ${bad}`).toBe(false);
    }
    expect(parse({ serviceRatings: { "not-a-uuid": 5 } }).success).toBe(false);
  });

  it("caps the comment, trims it, and treats blank as none", () => {
    expect(parse({ comment: "x".repeat(f.schema.REVIEW_COMMENT_MAX) }).success).toBe(true);
    expect(parse({ comment: "x".repeat(f.schema.REVIEW_COMMENT_MAX + 1) }).success).toBe(false);
    expect(parse({ comment: "   " })).toMatchObject({ success: true, data: { comment: undefined } });
    expect(parse({ comment: " hi " })).toMatchObject({ data: { comment: "hi" } });
  });

  it("reads the public form encoding (blank stars mean not rated)", () => {
    const form = new FormData();
    form.set("token", "abc");
    form.set("salon", "4");
    form.set(`service:${line}`, "5");
    form.set("service:7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02", ""); // skipped
    form.set(`staff:${line}`, "2");
    form.set("comment", "");
    const parsed = f.schema.submitReviewInputSchema.safeParse(f.schema.reviewInputFromForm(form));
    expect(parsed).toMatchObject({ success: true, data: { token: "abc", salonRating: 4, serviceRatings: { [line]: 5 }, staffRatings: { [line]: 2 } } });
    const missing = new FormData();
    missing.set("token", "abc");
    expect(f.schema.submitReviewInputSchema.safeParse(f.schema.reviewInputFromForm(missing)).success).toBe(false);
  });
});
