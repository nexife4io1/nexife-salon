import { describe, expect, it } from "vitest";
import { attendanceCredentialsSchema, normalizePhone, normalizeRegistrationCode } from "@/server/attendance/schema";
import { generateRegistrationCode } from "@/server/staff/registration-code";

describe("registration code generation", () => {
  it("makes 8-character codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) expect(generateRegistrationCode()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
  });

  it("does not repeat across a large sample", () => {
    const codes = new Set(Array.from({ length: 2_000 }, generateRegistrationCode));
    expect(codes.size).toBe(2_000);
  });
});

describe("normalisation", () => {
  it("canonicalises codes typed by hand", () => {
    expect(normalizeRegistrationCode(" ab3d-7k2m ")).toBe("AB3D7K2M");
  });

  it("compares phones by digits, keeping only a leading plus", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("(987) 654-3210")).toBe("9876543210");
  });
});

describe("attendanceCredentialsSchema", () => {
  const valid = { salonCode: " Glow-Studio ", registrationCode: "ab3d 7k2m", phone: "+91 98765 43210" };

  it("normalises all three fields", () => {
    expect(attendanceCredentialsSchema.parse(valid)).toEqual({ salonCode: "glow-studio", registrationCode: "AB3D7K2M", phone: "+919876543210" });
  });

  it("rejects blanks and malformed phones with field errors", () => {
    const r = attendanceCredentialsSchema.safeParse({ salonCode: "", registrationCode: "", phone: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["salonCode", "registrationCode", "phone"]));
  });
});
