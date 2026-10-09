import { describe, expect, it } from "vitest";
import {
  addTenantServicesInputSchema,
  createServiceTemplateInputSchema,
  onboardTenantInputSchema,
  updateTenantServiceInputSchema,
} from "@/server/tenants/schema";

const TEMPLATE_ID = "c7e1a5d0-3b2f-4a6e-9c1d-000000000001";

const valid = () => ({
  tenant: { name: "Glow Studio", slug: "glow-studio", currency: "USD", timezone: "America/New_York" },
  owner: { name: "Ada Owner", username: "ada", password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
  branch: { name: "Main Street", addressLine: "1 Main St", city: "", phone: "" },
  services: [{ templateId: TEMPLATE_ID, priceCents: 5_500, durationMinutes: 45 }],
});

function errorPaths(input: unknown) {
  const result = onboardTenantInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("onboardTenantInputSchema", () => {
  it("accepts a complete input and normalises empty optional branch fields", () => {
    const parsed = onboardTenantInputSchema.parse(valid());
    expect(parsed.branch.city).toBeUndefined();
    expect(parsed.branch.phone).toBeUndefined();
  });

  it.each(["ab", "Has Caps", "under_score", "x".repeat(41), ""])("rejects slug %j", (slug) => {
    const input = valid();
    input.tenant.slug = slug;
    expect(errorPaths(input)).toContain("tenant.slug");
  });

  it.each(["usd", "US", "USDX", "ZZZ", ""])("rejects currency %j", (currency) => {
    const input = valid();
    input.tenant.currency = currency;
    expect(errorPaths(input)).toContain("tenant.currency");
  });

  it("accepts real currencies and rejects unknown timezones", () => {
    const eur = valid();
    eur.tenant.currency = "EUR";
    expect(onboardTenantInputSchema.safeParse(eur).success).toBe(true);

    const input = valid();
    input.tenant.timezone = "Mars/Olympus_Mons";
    expect(errorPaths(input)).toContain("tenant.timezone");
  });

  it("accepts UTC and IANA timezones", () => {
    for (const timezone of ["UTC", "Asia/Kolkata", "Europe/London"]) {
      const input = valid();
      input.tenant.timezone = timezone;
      expect(onboardTenantInputSchema.safeParse(input).success).toBe(true);
    }
  });

  it("rejects a short password and a mismatched confirmation", () => {
    const short = valid();
    short.owner.password = short.owner.confirmPassword = "too-short";
    expect(errorPaths(short)).toContain("owner.password");

    const mismatch = valid();
    mismatch.owner.confirmPassword = "something-else-entirely";
    expect(errorPaths(mismatch)).toEqual(["owner.confirmPassword"]);
  });

  it("requires at least one service and no duplicates", () => {
    const empty = { ...valid(), services: [] };
    expect(errorPaths(empty)).toContain("services");

    const dup = valid();
    dup.services.push({ ...dup.services[0]! });
    expect(errorPaths(dup)).toContain("services");
  });

  it("reports bad service numbers per row", () => {
    const input = valid();
    input.services[0]!.priceCents = -1;
    input.services[0]!.durationMinutes = 0;
    expect(errorPaths(input)).toEqual(expect.arrayContaining(["services.0.priceCents", "services.0.durationMinutes"]));
  });

  it("reuses the branch rules (name and address required)", () => {
    const input = valid();
    input.branch.name = "";
    input.branch.addressLine = "";
    expect(errorPaths(input)).toEqual(expect.arrayContaining(["branch.name", "branch.addressLine"]));
  });
});

describe("audience and branch offerings", () => {
  it("defaults a template to unisex and accepts women/men/kids", () => {
    const base = { name: "Facial", defaultDurationMinutes: 60, defaultPriceCents: 8_000 };
    expect(createServiceTemplateInputSchema.parse(base).audience).toBe("unisex");
    for (const audience of ["women", "men", "kids"]) {
      expect(createServiceTemplateInputSchema.parse({ ...base, audience }).audience).toBe(audience);
    }
    expect(createServiceTemplateInputSchema.safeParse({ ...base, audience: "everyone" }).success).toBe(false);
  });

  it("lets the first branch offer only services that were picked", () => {
    const ok = valid();
    expect(onboardTenantInputSchema.parse({ ...ok, branch: { ...ok.branch, offeredTemplateIds: [TEMPLATE_ID] } }).branch.offeredTemplateIds).toEqual([TEMPLATE_ID]);
    expect(onboardTenantInputSchema.parse(ok).branch.offeredTemplateIds).toEqual([]);

    const other = "c7e1a5d0-3b2f-4a6e-9c1d-000000000002";
    expect(errorPaths({ ...ok, branch: { ...ok.branch, offeredTemplateIds: [other] } })).toContain("branch.offeredTemplateIds.0");
  });
});

describe("other tenant inputs", () => {
  it("validates tenant service updates", () => {
    const ok = { tenantId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01", serviceId: TEMPLATE_ID, priceCents: 100, durationMinutes: 30, active: true };
    expect(updateTenantServiceInputSchema.safeParse(ok).success).toBe(true);
    expect(updateTenantServiceInputSchema.safeParse({ ...ok, priceCents: undefined }).success).toBe(false);
  });

  it("requires services when adding to a tenant", () => {
    expect(addTenantServicesInputSchema.safeParse({ tenantId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01", services: [] }).success).toBe(false);
  });

  it("normalises an empty template category to null", () => {
    const parsed = createServiceTemplateInputSchema.parse({ name: "Facial", category: "  ", defaultDurationMinutes: 60, defaultPriceCents: 8_000 });
    expect(parsed.category).toBeNull();
  });
});
