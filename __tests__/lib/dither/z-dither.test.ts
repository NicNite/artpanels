import { describe, it, expect } from "vitest";
import { computeZDither, interleavePattern } from "@/lib/dither/z-dither";

describe("interleavePattern", () => {
  it("distributes 7:3 across 10 layers as ABABAABABA", () => {
    const pattern = interleavePattern(10, 7);
    expect(pattern).toHaveLength(10);
    expect(pattern.filter((v) => v).length).toBe(7);
    expect(pattern.filter((v) => !v).length).toBe(3);
    const bIndices = pattern
      .map((v, i) => (!v ? i : -1))
      .filter((i) => i >= 0);
    expect(bIndices.length).toBe(3);
    for (let i = 1; i < bIndices.length; i++) {
      expect(bIndices[i] - bIndices[i - 1]).toBeGreaterThanOrEqual(2);
    }
  });

  it("5:5 split produces alternating pattern", () => {
    const pattern = interleavePattern(10, 5);
    expect(pattern.filter((v) => v).length).toBe(5);
  });

  it("10:0 produces all-A", () => {
    const pattern = interleavePattern(10, 10);
    expect(pattern.every((v) => v)).toBe(true);
  });

  it("0:10 produces all-B", () => {
    const pattern = interleavePattern(10, 0);
    expect(pattern.every((v) => !v)).toBe(true);
  });
});

describe("computeZDither", () => {
  it("returns null when numLayers < 3", () => {
    const result = computeZDither({
      targetLab: { L: 50, a: 20, b: -10 },
      assignedFilament: { id: "f1", lab: { L: 50, a: 30, b: -10 } },
      availableFilaments: [
        { id: "f1", lab: { L: 50, a: 30, b: -10 } },
        { id: "f2", lab: { L: 50, a: 10, b: -10 } },
      ],
      numLayers: 2,
    });
    expect(result).toBeNull();
  });

  it("returns layer assignments for 10 layers with two filaments", () => {
    const result = computeZDither({
      targetLab: { L: 50, a: 20, b: 0 },
      assignedFilament: { id: "f1", lab: { L: 50, a: 30, b: 0 } },
      availableFilaments: [
        { id: "f1", lab: { L: 50, a: 30, b: 0 } },
        { id: "f2", lab: { L: 50, a: 10, b: 0 } },
      ],
      numLayers: 10,
    });
    expect(result).not.toBeNull();
    expect(result!.layerFilamentIds).toHaveLength(10);
    const unique = new Set(result!.layerFilamentIds);
    expect(unique.size).toBe(2);
  });

  it("returns only the assigned filament when no mix improves deltaE", () => {
    const result = computeZDither({
      targetLab: { L: 50, a: 30, b: 0 },
      assignedFilament: { id: "f1", lab: { L: 50, a: 30, b: 0 } },
      availableFilaments: [
        { id: "f1", lab: { L: 50, a: 30, b: 0 } },
        { id: "f2", lab: { L: 90, a: -40, b: 50 } },
      ],
      numLayers: 10,
    });
    expect(result).toBeNull();
  });
});
