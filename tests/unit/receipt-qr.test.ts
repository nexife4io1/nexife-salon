import { describe, expect, it } from "vitest";
import { qrMatrix, qrPath } from "@/components/views/appointments/qr";

const URL = "https://salon.example.com/review/dGVzdC10ZXN0LXRlc3QtdGVzdC10ZXN0LXRlc3QtdGVzdC10ZXN0.abcdefghijklmnopqrstuv";

/** Rows of a 7x7 finder pattern: solid ring, white ring, 3x3 solid centre. */
const FINDER = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];
const finderAt = (m: ReturnType<typeof qrMatrix>, top: number, left: number) =>
  FINDER.every((row, r) => [...row].every((cell, c) => m.dark[top + r]![left + c] === (cell === "1")));

describe("receipt QR code", () => {
  it("is a square symbol with the three finder patterns every scanner locks on to", () => {
    const m = qrMatrix(URL);
    expect(m.dark).toHaveLength(m.size);
    expect(m.dark.every((row) => row.length === m.size)).toBe(true);
    expect((m.size - 17) % 4).toBe(0); // 21, 25, 29 ... = 17 + 4 x version
    expect(finderAt(m, 0, 0)).toBe(true);
    expect(finderAt(m, 0, m.size - 7)).toBe(true);
    expect(finderAt(m, m.size - 7, 0)).toBe(true);
    expect(m.dark[m.size - 8]![8]).toBe(true); // the always-dark module
  });

  it("is deterministic for the same link and different for another one", () => {
    expect(qrMatrix(URL).dark).toEqual(qrMatrix(URL).dark);
    expect(qrMatrix(URL + "x").dark).not.toEqual(qrMatrix(URL).dark);
  });

  it("stays a scannable size for a real review link", () => {
    expect(qrMatrix(URL).size).toBeLessThanOrEqual(53); // up to version 9: comfortable at 4 cm on a receipt
  });

  it("draws every dark module inside a 4-module quiet zone", () => {
    const m = qrMatrix(URL);
    const { viewBox, d } = qrPath(m);
    expect(viewBox).toBe(`0 0 ${m.size + 8} ${m.size + 8}`);
    const darkCount = m.dark.flat().filter(Boolean).length;
    expect(d.split("M").length - 1).toBe(darkCount);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("M4 4h1v1h-1z"); // top-left finder corner, offset by the quiet zone
  });
});
