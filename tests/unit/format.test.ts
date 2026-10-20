import { describe, expect, it } from "vitest";
import { centsToInputValue, formatDate, formatMoney, initials, parseMoneyToCents, pluralize } from "@/lib/format";

describe("format", () => {
  it("formats whole and fractional cents", () => {
    expect(formatMoney(428_000)).toBe("$4,280");
    expect(formatMoney(1_050)).toBe("$10.50");
  });

  it("pluralizes and builds initials", () => {
    expect(pluralize(1, "Appointment")).toBe("1 Appointment");
    expect(pluralize(24, "Appointment")).toBe("24 Appointments");
    expect(initials("Sarah Jenkins")).toBe("SJ");
  });

  it("parses typed prices into cents", () => {
    expect(parseMoneyToCents("95")).toBe(9_500);
    expect(parseMoneyToCents("$1,250.5")).toBe(125_050);
    expect(parseMoneyToCents("19.99")).toBe(1_999);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
    expect(parseMoneyToCents("1.234")).toBeNull();
    expect(centsToInputValue(9_500)).toBe("95.00");
  });

  it("formats dates in UTC", () => {
    expect(formatDate("2026-01-12T09:00:00.000Z")).toBe("Jan 12, 2026");
  });
});
