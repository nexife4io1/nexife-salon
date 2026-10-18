import { describe, expect, it } from "vitest";
import { computeAvailability, localDayAndMinutes } from "@/server/staff/availability";
import { parseStaffFilters, staffFiltersHref, staffFormValues, staffInputSchema } from "@/server/staff/schema";

const BRANCH = "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01";
const base = { name: "Elena Rodriguez", branchId: BRANCH };
const fieldsOf = (raw: Record<string, unknown>) => {
  const r = staffInputSchema.safeParse(raw);
  return r.success ? null : r.error.issues.map((i) => i.path.join("."));
};

describe("staffInputSchema", () => {
  it("accepts the minimal profile and treats blank optional fields as absent", () => {
    const parsed = staffInputSchema.parse({ ...base, phone: "", gender: "", jobRole: "", weeklyOff: "", shiftStart: "", shiftEnd: "", monthlySalaryCents: "", joinedOn: "", yearsExperience: "", serviceIds: ["stale-service-id"] });
    expect(parsed).toMatchObject({ status: "active", breaks: [] });
    expect(parsed).not.toHaveProperty("serviceIds");
    expect(parsed.phone).toBeUndefined();
    expect(parsed.monthlySalaryCents).toBeUndefined();
  });

  it("requires a real branch id and a name", () => {
    expect(fieldsOf({ name: "E", branchId: "" })).toEqual(expect.arrayContaining(["name", "branchId"]));
  });

  it("converts salary text to cents and rejects junk", () => {
    expect(staffInputSchema.parse({ ...base, monthlySalaryCents: "45,000" }).monthlySalaryCents).toBe(4_500_000);
    expect(fieldsOf({ ...base, monthlySalaryCents: "-5" })).toContain("monthlySalaryCents");
    expect(fieldsOf({ ...base, monthlySalaryCents: "abc" })).toContain("monthlySalaryCents");
  });

  it("validates numbers, dates and phones", () => {
    expect(fieldsOf({ ...base, yearsExperience: "-1" })).toContain("yearsExperience");
    expect(fieldsOf({ ...base, casualLeaves: "1.5" })).toContain("casualLeaves");
    expect(fieldsOf({ ...base, joinedOn: "2024-02-31" })).toContain("joinedOn");
    expect(fieldsOf({ ...base, phone: "call me" })).toContain("phone");
    expect(fieldsOf({ ...base, emergencyContactPhone: "12" })).toContain("emergencyContactPhone");
  });

  it("requires both shift times, in order", () => {
    expect(fieldsOf({ ...base, shiftStart: "09:00" })).toContain("shiftEnd");
    expect(fieldsOf({ ...base, shiftStart: "18:00", shiftEnd: "09:00" })).toContain("shiftEnd");
    expect(fieldsOf({ ...base, shiftStart: "9am", shiftEnd: "18:00" })).toContain("shiftStart");
  });

  it("validates breaks against the shift and each other", () => {
    const shift = { shiftStart: "09:00", shiftEnd: "18:00" };
    expect(fieldsOf({ ...base, breaks: [{ start: "13:00", end: "14:00" }] })).toContain("breaks"); // no shift
    expect(fieldsOf({ ...base, ...shift, breaks: [{ start: "14:00", end: "13:00" }] })).toContain("breaks.0.end");
    expect(fieldsOf({ ...base, ...shift, breaks: [{ start: "08:00", end: "09:30" }] })).toContain("breaks.0.start");
    expect(fieldsOf({ ...base, ...shift, breaks: [{ start: "12:00", end: "13:00" }, { start: "12:30", end: "13:30" }] })).toContain("breaks.1.start");
    expect(fieldsOf({ ...base, ...shift, breaks: [{ start: "12:00", end: "13:00" }, { start: "15:00", end: "15:15" }] })).toBeNull();
  });
});

describe("parseStaffFilters", () => {
  it("keeps valid params and drops invalid ones instead of failing", () => {
    expect(parseStaffFilters({ q: " ola ", status: "on_leave", branchId: BRANCH })).toEqual({ q: "ola", status: "on_leave", branchId: BRANCH });
    expect(parseStaffFilters({ q: "", status: "retired", branchId: "nope" })).toEqual({ q: undefined, status: undefined, branchId: undefined });
    expect(parseStaffFilters({ status: ["inactive", "active"] }).status).toBe("inactive");
  });
});

describe("computeAvailability", () => {
  const schedule = {
    weeklyOffDay: 0,
    hours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "09:00", end: "18:00" })),
    breaks: [{ label: "Lunch", start: "13:00", end: "14:00" }],
  };
  const wed = (time: string) => new Date(`2026-10-14T${time}:00Z`); // a Wednesday

  it("reads the local weekday and time in the given timezone", () => {
    expect(localDayAndMinutes(new Date("2026-10-14T23:30:00Z"), "Asia/Kolkata")).toEqual({ day: 4, minutes: 5 * 60 });
    expect(localDayAndMinutes(wed("10:00"), "Not/AZone")).toEqual({ day: 3, minutes: 600 }); // falls back to UTC
  });

  it("walks through the day", () => {
    const state = (t: string) => computeAvailability({ status: "active", schedule }, wed(t), "UTC").state;
    expect(state("08:59")).toBe("off_shift");
    expect(state("09:00")).toBe("available");
    expect(state("13:00")).toBe("on_break");
    expect(state("14:00")).toBe("available");
    expect(state("18:00")).toBe("off_shift");
  });

  it("lets status override the schedule and never invents availability", () => {
    expect(computeAvailability({ status: "on_leave", schedule }, wed("10:00"), "UTC").state).toBe("on_leave");
    expect(computeAvailability({ status: "inactive", schedule }, wed("10:00"), "UTC").state).toBe("inactive");
    expect(computeAvailability({ status: "active", schedule: { weeklyOffDay: null, hours: [], breaks: [] } }, wed("10:00"), "UTC").state).toBe("unscheduled");
    expect(computeAvailability({ status: "active", schedule: { ...schedule, weeklyOffDay: 3 } }, wed("10:00"), "UTC").state).toBe("day_off");
  });
});

describe("staffFormValues", () => {
  it("keeps every submitted entry so a failed save can repopulate the form", () => {
    const fd = new FormData();
    fd.append("name", "E");
    fd.append("phone", "98765 43210");
    fd.append("breakStart", "12:00");
    fd.append("breakStart", "15:00");
    fd.append("file", new Blob(["x"]), "x.txt");
    expect(staffFormValues(fd)).toEqual({ name: ["E"], phone: ["98765 43210"], breakStart: ["12:00", "15:00"] });
  });
});

describe("staffFiltersHref", () => {
  it("builds the directory URL used by the auto-applying filters", () => {
    expect(staffFiltersHref({})).toBe("/staff");
    expect(staffFiltersHref({ q: "  ", branchId: "", status: undefined })).toBe("/staff");
    expect(staffFiltersHref({ q: " Ana ", branchId: BRANCH, status: "on_leave" })).toBe(`/staff?q=Ana&branchId=${BRANCH}&status=on_leave`);
  });

  it("round-trips through parseStaffFilters", () => {
    const url = new URL(staffFiltersHref({ q: "Ana", status: "active" }), "http://x");
    expect(parseStaffFilters(Object.fromEntries(url.searchParams))).toEqual({ q: "Ana", status: "active" });
  });
});
