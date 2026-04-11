import { describe, it, expect } from "vitest";
import { generateLayeredMesh } from "@/lib/export/layered-mesh";
import type { LayerColorMap } from "@/lib/dither/types";

describe("generateLayeredMesh", () => {
  const materials = [
    { id: "a", name: "Filament A", hexColor: "#ff0000" },
    { id: "b", name: "Filament B", hexColor: "#0000ff" },
  ];

  it("single block single layer produces 8 vertices and 12 triangles", () => {
    const layers: LayerColorMap = [
      {
        layerIndex: 0,
        zPosition: 0,
        blocks: [{ x: 0, y: 0, filamentId: "a" }],
      },
    ];
    const result = generateLayeredMesh({
      layers,
      materials,
      blockCols: 1,
      blockRows: 1,
      panelWidthMm: 100,
      panelHeightMm: 100,
      layerHeightMm: 0.2,
    });
    expect(result.vertices).toHaveLength(8);
    expect(result.triangles).toHaveLength(12);
  });

  it("two layers same block produce two stacked boxes (16 vertices, 24 triangles)", () => {
    const layers: LayerColorMap = [
      { layerIndex: 0, zPosition: 0, blocks: [{ x: 0, y: 0, filamentId: "a" }] },
      { layerIndex: 1, zPosition: 0.2, blocks: [{ x: 0, y: 0, filamentId: "b" }] },
    ];
    const result = generateLayeredMesh({
      layers,
      materials,
      blockCols: 1,
      blockRows: 1,
      panelWidthMm: 100,
      panelHeightMm: 100,
      layerHeightMm: 0.2,
    });
    expect(result.vertices).toHaveLength(16);
    expect(result.triangles).toHaveLength(24);
  });

  it("material indices map filament IDs to the materials array order", () => {
    const layers: LayerColorMap = [
      { layerIndex: 0, zPosition: 0, blocks: [{ x: 0, y: 0, filamentId: "b" }] },
    ];
    const result = generateLayeredMesh({
      layers,
      materials,
      blockCols: 1,
      blockRows: 1,
      panelWidthMm: 100,
      panelHeightMm: 100,
      layerHeightMm: 0.2,
    });
    for (const tri of result.triangles) {
      expect(tri.materialIndex).toBe(1);
    }
  });

  it("block geometry is positioned correctly in XY", () => {
    const layers: LayerColorMap = [
      {
        layerIndex: 0,
        zPosition: 0,
        blocks: [
          { x: 0, y: 0, filamentId: "a" },
          { x: 1, y: 0, filamentId: "b" },
        ],
      },
    ];
    const result = generateLayeredMesh({
      layers,
      materials,
      blockCols: 2,
      blockRows: 1,
      panelWidthMm: 100,
      panelHeightMm: 50,
      layerHeightMm: 0.2,
    });
    const maxX = Math.max(...result.vertices.map((v) => v.x));
    expect(maxX).toBeCloseTo(100);
    const minX = Math.min(...result.vertices.map((v) => v.x));
    expect(minX).toBeCloseTo(0);
  });

  it("all triangles reference valid vertex indices", () => {
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
          { x: 0, y: 0, filamentId: "b" },
          { x: 1, y: 0, filamentId: "a" },
        ],
      },
    ];
    const result = generateLayeredMesh({
      layers,
      materials,
      blockCols: 2,
      blockRows: 1,
      panelWidthMm: 100,
      panelHeightMm: 50,
      layerHeightMm: 0.2,
    });
    const vertexCount = result.vertices.length;
    for (const tri of result.triangles) {
      expect(tri.v1).toBeGreaterThanOrEqual(0);
      expect(tri.v1).toBeLessThan(vertexCount);
      expect(tri.v2).toBeGreaterThanOrEqual(0);
      expect(tri.v2).toBeLessThan(vertexCount);
      expect(tri.v3).toBeGreaterThanOrEqual(0);
      expect(tri.v3).toBeLessThan(vertexCount);
    }
  });
});
