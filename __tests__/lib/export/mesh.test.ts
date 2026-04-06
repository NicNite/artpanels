import { describe, it, expect } from "vitest";
import { generateMesh } from "@/lib/export/mesh";

describe("generateMesh", () => {
  const baseInput = {
    panelWidthMm: 100,
    panelHeightMm: 100,
    thicknessMinMm: 1,
    thicknessMaxMm: 5,
  };

  it("single pixel mesh produces 8 vertices and 12 triangles", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [{ brightness: 0.5, materialIndex: 0 }],
      gridWidth: 1,
      gridHeight: 1,
    });

    expect(result.vertices).toHaveLength(8);
    expect(result.triangles).toHaveLength(12);
  });

  it("2x2 grid produces 48 triangles (4 columns x 12)", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [
        { brightness: 0.0, materialIndex: 0 },
        { brightness: 0.5, materialIndex: 1 },
        { brightness: 0.8, materialIndex: 0 },
        { brightness: 1.0, materialIndex: 1 },
      ],
      gridWidth: 2,
      gridHeight: 2,
    });

    expect(result.triangles).toHaveLength(48);
  });

  it("2x2 grid produces 32 vertices (4 columns x 8)", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [
        { brightness: 0.0, materialIndex: 0 },
        { brightness: 0.5, materialIndex: 1 },
        { brightness: 0.8, materialIndex: 0 },
        { brightness: 1.0, materialIndex: 1 },
      ],
      gridWidth: 2,
      gridHeight: 2,
    });

    expect(result.vertices).toHaveLength(32);
  });

  it("brightness 0 (dark) produces max Z equal to thicknessMaxMm", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [{ brightness: 0, materialIndex: 0 }],
      gridWidth: 1,
      gridHeight: 1,
    });

    const maxZ = Math.max(...result.vertices.map((v) => v.z));
    expect(maxZ).toBeCloseTo(baseInput.thicknessMaxMm);
  });

  it("brightness 1 (bright) produces max Z equal to thicknessMinMm", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [{ brightness: 1, materialIndex: 0 }],
      gridWidth: 1,
      gridHeight: 1,
    });

    const maxZ = Math.max(...result.vertices.map((v) => v.z));
    expect(maxZ).toBeCloseTo(baseInput.thicknessMinMm);
  });

  it("all triangles have materialIndex defined", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [
        { brightness: 0.3, materialIndex: 0 },
        { brightness: 0.7, materialIndex: 2 },
        { brightness: 0.1, materialIndex: 1 },
        { brightness: 0.9, materialIndex: 3 },
      ],
      gridWidth: 2,
      gridHeight: 2,
    });

    for (const tri of result.triangles) {
      expect(tri.materialIndex).toBeDefined();
      expect(typeof tri.materialIndex).toBe("number");
    }
  });

  it("triangles reference valid vertex indices", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [{ brightness: 0.5, materialIndex: 0 }],
      gridWidth: 1,
      gridHeight: 1,
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

  it("each triangle carries the pixel materialIndex", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [{ brightness: 0.5, materialIndex: 7 }],
      gridWidth: 1,
      gridHeight: 1,
    });

    for (const tri of result.triangles) {
      expect(tri.materialIndex).toBe(7);
    }
  });

  it("column base dimensions match panel/grid ratio", () => {
    // 3x2 grid = 6 pixels; inspect the first column (col=0, row=0)
    const pixels = Array.from({ length: 6 }, (_, i) => ({
      brightness: 0,
      materialIndex: 0,
    }));
    const result = generateMesh({
      panelWidthMm: 60,
      panelHeightMm: 40,
      thicknessMinMm: 1,
      thicknessMaxMm: 3,
      pixels,
      gridWidth: 3,
      gridHeight: 2,
    });

    // First column occupies x in [0, 20], y in [0, 20]
    const firstColVertices = result.vertices.slice(0, 8);
    const xs = firstColVertices.map((v) => v.x);
    const ys = firstColVertices.map((v) => v.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20); // 60/3
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(20); // 40/2
  });

  it("bottom vertices are at z=0", () => {
    const result = generateMesh({
      ...baseInput,
      pixels: [{ brightness: 0.5, materialIndex: 0 }],
      gridWidth: 1,
      gridHeight: 1,
    });

    const minZ = Math.min(...result.vertices.map((v) => v.z));
    expect(minZ).toBe(0);
  });
});
