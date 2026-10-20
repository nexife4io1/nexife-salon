import { describe, expect, it } from "vitest";
import { customerInputSchema, customersHref, normalizePhone, parseCustomerFilters } from "@/server/customers/schema";

describe("normalizePhone", () => {
  it("strips separators and keeps a leading plus", () => {
    expect(normalizePhone("+91 98450-12345")).toEqual({ phone: "+919845012345", key: "919845012345" });
    expect(normalizePhone("(555) 010.9999")).toEqual({ phone: "5550109999", key: "5550109999" });
  });

  it("gives formatting variants the same key", () => {
    expect(normalizePhone("98450 12345")?.key).toBe(normalizePhone("9845012345")?.key);
    expect(normalizePhone("+1 555 010 9999")?.key).toBe(normalizePhone("15550109999")?.key);
  });

  it.each(["", "abc", "12345", "1234567890123456", "98450+12345", "98450 12345 ext 4", "+"])("rejects %j", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe("customerInputSchema", () => {
  const valid = { name: "  Sophia Loren ", phone: "+91 98450 12345" };

  it("trims, normalizes and treats blank optionals as missing", () => {
    const parsed = customerInputSchema.parse({ ...valid, email: "", birthday: "", gender: "", notes: "  " });
    expect(parsed).toMatchObject({ name: "Sophia Loren", phone: { phone: "+919845012345", key: "919845012345" } });
    expect(parsed.email).toBeUndefined();
    expect(parsed.birthday).toBeUndefined();
    expect(parsed.gender).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it("lowercases email and accepts the optional fields", () => {
    const parsed = customerInputSchema.parse({ ...valid, email: "Sophia@Example.COM", birthday: "1990-02-28", gender: "female", notes: "Prefers Elena" });
    expect(parsed).toMatchObject({ email: "sophia@example.com", birthday: "1990-02-28", gender: "female", notes: "Prefers Elena" });
  });

  const errorsFor = (raw: Record<string, unknown>) => {
    const result = customerInputSchema.safeParse(raw);
    return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
  };

  it("requires a name and a phone", () => {
    expect(Object.keys(errorsFor({}))).toEqual(expect.arrayContaining(["name", "phone"]));
    expect(errorsFor({ name: "A", phone: "" })).toMatchObject({ name: expect.any(String), phone: "Enter a contact number" });
  });

  it("rejects an implausible phone, bad email, impossible or future birthday, unknown gender and long notes", () => {
    const errors = errorsFor({
      ...valid,
      phone: "call me",
      email: "nope",
      birthday: "2026-02-31",
      gender: "robot",
      notes: "x".repeat(1001),
    });
    expect(Object.keys(errors).sort()).toEqual(["birthday", "email", "gender", "notes", "phone"]);
    expect(errorsFor({ ...valid, birthday: "2999-01-01" }).birthday).toMatch(/future/);
  });
});

describe("directory filters", () => {
  it("parses URL params leniently", () => {
    expect(parseCustomerFilters({ q: " sophia ", sort: "visits", page: "3" })).toEqual({ q: "sophia", sort: "visits", page: 3 });
    expect(parseCustomerFilters({ sort: "bogus", page: "-4", q: ["a", "b"] })).toEqual({ q: "a", sort: "recent", page: 1 });
    expect(parseCustomerFilters({})).toEqual({ q: undefined, sort: "recent", page: 1 });
  });

  it("builds minimal hrefs", () => {
    expect(customersHref({})).toBe("/customers");
    expect(customersHref({ q: " a b ", sort: "recent", page: 1 })).toBe("/customers?q=a+b");
    expect(customersHref({ sort: "name", page: 2 })).toBe("/customers?sort=name&page=2");
  });
});
