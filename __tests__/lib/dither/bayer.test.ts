import { describe, it, expect } from "vitest";
import { generateBayer, bayerThreshold } from "@/lib/dither/bayer";

describe("generateBayer", () => {
  it("generates a 2×2 matrix with values [0,1,2,3]", () => {
    const m = generateBayer(1); // order 1 → 2×2
    expect(m).toEqual([
      [0, 2],
      [3, 1],
    ]);
  });

  it("generates a 4×4 matrix with values 0–15", () => {
    const m = generateBayer(2); // order 2 → 4×4
    expect(m.length).toBe(4);
    expect(m[0].length).toBe(4);
    const flat = m.flat().sort((a, b) => a - b);
    expect(flat).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it("generates an 8×8 matrix with values 0–63", () => {
    const m = generateBayer(3); // order 3 → 8×8
    expect(m.length).toBe(8);
    const flat = m.flat().sort((a, b) => a - b);
    expect(flat).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });
});

describe("bayerThreshold", () => {
  it("returns normalized threshold in [0,1) for 4×4 matrix", () => {
    const m = generateBayer(2);
    const t = bayerThreshold(m, 0, 0);
    // (value + 0.5) / 16  →  for m[0][0]=0: 0.5/16 = 0.03125
    expect(t).toBeCloseTo(0.03125);
  });

  it("wraps coordinates that exceed matrix size", () => {
    const m = generateBayer(1); // 2×2
    // row=5, col=3 → row%2=1, col%2=1 → m[1][1]=1
    const t = bayerThreshold(m, 5, 3);
    expect(t).toBeCloseTo((1 + 0.5) / 4); // 0.375
  });

  it("all thresholds for 4×4 are unique and in [0,1)", () => {
    const m = generateBayer(2);
    const thresholds = new Set<number>();
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const t = bayerThreshold(m, r, c);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(1);
        thresholds.add(t);
      }
    }
    expect(thresholds.size).toBe(16);
  });
});
