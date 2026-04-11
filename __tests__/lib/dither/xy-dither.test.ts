import { describe, it, expect } from "vitest";
import { computeXYDither } from "@/lib/dither/xy-dither";

describe("computeXYDither", () => {
  const filaments = [
    { id: "red", lab: { L: 53, a: 80, b: 67 } },
    { id: "blue", lab: { L: 32, a: 79, b: -108 } },
  ];

  it("assigns each block to one of two candidate filaments", () => {
    const result = computeXYDither({
      blocks: [
        { row: 0, col: 0, targetLab: { L: 42, a: 80, b: -20 } },
        { row: 0, col: 1, targetLab: { L: 42, a: 80, b: -20 } },
        { row: 1, col: 0, targetLab: { L: 42, a: 80, b: -20 } },
        { row: 1, col: 1, targetLab: { L: 42, a: 80, b: -20 } },
      ],
      filaments,
      bayerOrder: 1,
    });

    expect(result).toHaveLength(4);
    for (const block of result) {
      expect(["red", "blue"]).toContain(block.filamentId);
    }
  });

  it("uses the two closest filaments to each block target", () => {
    const manyFilaments = [
      { id: "red", lab: { L: 53, a: 80, b: 67 } },
      { id: "green", lab: { L: 87, a: -86, b: 83 } },
      { id: "blue", lab: { L: 32, a: 79, b: -108 } },
    ];

    const result = computeXYDither({
      blocks: [
        { row: 0, col: 0, targetLab: { L: 70, a: -3, b: 75 } },
      ],
      filaments: manyFilaments,
      bayerOrder: 1,
    });

    expect(result).toHaveLength(1);
    expect(["red", "green"]).toContain(result[0].filamentId);
  });

  it("returns all same filament when target exactly matches one", () => {
    const result = computeXYDither({
      blocks: [
        { row: 0, col: 0, targetLab: { L: 53, a: 80, b: 67 } },
        { row: 0, col: 1, targetLab: { L: 53, a: 80, b: 67 } },
        { row: 1, col: 0, targetLab: { L: 53, a: 80, b: 67 } },
        { row: 1, col: 1, targetLab: { L: 53, a: 80, b: 67 } },
      ],
      filaments,
      bayerOrder: 1,
    });

    for (const block of result) {
      expect(block.filamentId).toBe("red");
    }
  });
});
