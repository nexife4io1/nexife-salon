import { describe, expect, it } from "vitest";
import { formatMoney, initials, pluralize } from "@/lib/format";

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
});
