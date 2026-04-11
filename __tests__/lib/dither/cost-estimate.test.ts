import { describe, it, expect } from "vitest";
import { estimateCost } from "@/lib/dither/cost-estimate";
import type { LayerColorMap } from "@/lib/dither/types";

describe("estimateCost", () => {
  it("returns zero swaps for uniform single-filament layers", () => {
    const layers: LayerColorMap = [
      { layerIndex: 0, zPosition: 0, blocks: [{ x: 0, y: 0, filamentId: "a" }] },
      { layerIndex: 1, zPosition: 0.2, blocks: [{ x: 0, y: 0, filamentId: "a" }] },
    ];
    const result = estimateCost(layers);
    expect(result.filamentSwaps).toBe(0);
    expect(result.purgeWasteGrams).toBe(0);
    expect(result.timeOverheadMinutes).toBe(0);
  });

  it("counts within-layer swaps when a layer has multiple filaments", () => {
    const layers: LayerColorMap = [
      {
        layerIndex: 0,
        zPosition: 0,
        blocks: [
          { x: 0, y: 0, filamentId: "a" },
          { x: 1, y: 0, filamentId: "b" },
          { x: 0, y: 1, filamentId: "a" },
          { x: 1, y: 1, filamentId: "b" },
        ],
      },
    ];
    const result = estimateCost(layers);
    expect(result.filamentSwaps).toBe(1);
  });

  it("counts between-layer swaps when layers switch filaments", () => {
    const layers: LayerColorMap = [
      { layerIndex: 0, zPosition: 0, blocks: [{ x: 0, y: 0, filamentId: "a" }] },
      { layerIndex: 1, zPosition: 0.2, blocks: [{ x: 0, y: 0, filamentId: "b" }] },
      { layerIndex: 2, zPosition: 0.4, blocks: [{ x: 0, y: 0, filamentId: "a" }] },
    ];
    const result = estimateCost(layers);
    expect(result.filamentSwaps).toBe(2);
  });

  it("estimates purge waste proportional to swaps", () => {
    const layers: LayerColorMap = [
      {
        layerIndex: 0,
        zPosition: 0,
        blocks: [
          { x: 0, y: 0, filamentId: "a" },
          { x: 1, y: 0, filamentId: "b" },
        ],
      },
      {
        layerIndex: 1,
        zPosition: 0.2,
        blocks: [
          { x: 0, y: 0, filamentId: "a" },
          { x: 1, y: 0, filamentId: "b" },
        ],
      },
    ];
    const result = estimateCost(layers);
    expect(result.purgeWasteGrams).toBeGreaterThan(0);
    expect(result.purgeWasteGrams).toBe(result.filamentSwaps * 0.5);
  });

  it("estimates time overhead proportional to swaps", () => {
    const layers: LayerColorMap = [
      { layerIndex: 0, zPosition: 0, blocks: [{ x: 0, y: 0, filamentId: "a" }] },
      { layerIndex: 1, zPosition: 0.2, blocks: [{ x: 0, y: 0, filamentId: "b" }] },
    ];
    const result = estimateCost(layers);
    expect(result.timeOverheadMinutes).toBeCloseTo(result.filamentSwaps * (2 / 60), 2);
  });
});
