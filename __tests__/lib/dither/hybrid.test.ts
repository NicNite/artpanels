import { describe, it, expect } from "vitest";
import { computeHybridDither } from "@/lib/dither/hybrid";
import type { DitherInput } from "@/lib/dither/types";

const filaments = [
  { id: "white", lab: { L: 95, a: 0, b: 0 }, hexColor: "#ffffff" },
  { id: "black", lab: { L: 5, a: 0, b: 0 }, hexColor: "#000000" },
  { id: "gray", lab: { L: 50, a: 0, b: 0 }, hexColor: "#808080" },
];

function makeInput(overrides: Partial<DitherInput> = {}): DitherInput {
  return {
    pixels: [
      {
        row: 0,
        col: 0,
        targetLab: { L: 70, a: 0, b: 0 },
        assignedFilamentId: "white",
        assignedLab: { L: 95, a: 0, b: 0 },
        colorError: 20,
        thickness: 2.0,
        numLayers: 10,
      },
    ],
    gridWidth: 1,
    gridHeight: 1,
    filaments,
    settings: {
      enabled: true,
      blockSizeMm: 3,
      zEnabled: true,
      xyEnabled: true,
      layerHeightMm: 0.2,
      nozzleWidthMm: 0.4,
    },
    panelWidthMm: 100,
    panelHeightMm: 100,
    ...overrides,
  };
}

describe("computeHybridDither", () => {
  it("produces a LayerColorMap with correct number of layers", () => {
    const input = makeInput();
    const result = computeHybridDither(input);
    expect(result.length).toBe(10);
  });

  it("each layer has blocks covering the grid", () => {
    const input = makeInput();
    const result = computeHybridDither(input);
    for (const layer of result) {
      expect(layer.blocks.length).toBeGreaterThanOrEqual(1);
      for (const block of layer.blocks) {
        expect(filaments.map((f) => f.id)).toContain(block.filamentId);
      }
    }
  });

  it("uses only Z-dithering when xyEnabled is false", () => {
    const input = makeInput({
      settings: {
        enabled: true,
        blockSizeMm: 3,
        zEnabled: true,
        xyEnabled: false,
        layerHeightMm: 0.2,
        nozzleWidthMm: 0.4,
      },
    });
    const result = computeHybridDither(input);
    for (const layer of result) {
      const ids = new Set(layer.blocks.map((b) => b.filamentId));
      expect(ids.size).toBe(1);
    }
  });

  it("uses only XY-dithering when zEnabled is false", () => {
    const input = makeInput({
      settings: {
        enabled: true,
        blockSizeMm: 3,
        zEnabled: false,
        xyEnabled: true,
        layerHeightMm: 0.2,
        nozzleWidthMm: 0.4,
      },
    });
    const result = computeHybridDither(input);
    if (result.length > 1) {
      const firstLayerIds = result[0].blocks.map((b) => b.filamentId).join(",");
      for (let i = 1; i < result.length; i++) {
        const layerIds = result[i].blocks.map((b) => b.filamentId).join(",");
        expect(layerIds).toBe(firstLayerIds);
      }
    }
  });

  it("skips pixels with colorError < 5", () => {
    const input = makeInput({
      pixels: [
        {
          row: 0,
          col: 0,
          targetLab: { L: 95, a: 0, b: 0 },
          assignedFilamentId: "white",
          assignedLab: { L: 95, a: 0, b: 0 },
          colorError: 2,
          thickness: 2.0,
          numLayers: 10,
        },
      ],
    });
    const result = computeHybridDither(input);
    for (const layer of result) {
      for (const block of layer.blocks) {
        expect(block.filamentId).toBe("white");
      }
    }
  });

  it("handles a 2×2 grid with mixed thicknesses", () => {
    const input = makeInput({
      pixels: [
        {
          row: 0, col: 0,
          targetLab: { L: 70, a: 0, b: 0 },
          assignedFilamentId: "white",
          assignedLab: { L: 95, a: 0, b: 0 },
          colorError: 20,
          thickness: 2.0,
          numLayers: 10,
        },
        {
          row: 0, col: 1,
          targetLab: { L: 30, a: 0, b: 0 },
          assignedFilamentId: "black",
          assignedLab: { L: 5, a: 0, b: 0 },
          colorError: 20,
          thickness: 0.4,
          numLayers: 2,
        },
        {
          row: 1, col: 0,
          targetLab: { L: 50, a: 0, b: 0 },
          assignedFilamentId: "gray",
          assignedLab: { L: 50, a: 0, b: 0 },
          colorError: 0,
          thickness: 1.0,
          numLayers: 5,
        },
        {
          row: 1, col: 1,
          targetLab: { L: 70, a: 0, b: 0 },
          assignedFilamentId: "white",
          assignedLab: { L: 95, a: 0, b: 0 },
          colorError: 20,
          thickness: 1.0,
          numLayers: 5,
        },
      ],
      gridWidth: 2,
      gridHeight: 2,
    });
    const result = computeHybridDither(input);
    expect(result.length).toBe(10);
  });
});
