import type { Vertex, Triangle, MeshData } from "./mesh";
import type { LayerColorMap } from "@/lib/dither/types";

type LayeredMeshInput = {
  layers: LayerColorMap;
  materials: { id: string; name: string; hexColor: string }[];
  blockCols: number;
  blockRows: number;
  panelWidthMm: number;
  panelHeightMm: number;
  layerHeightMm: number;
};

/**
 * Generate a multi-layer block mesh from a LayerColorMap.
 * Each block in each layer becomes a rectangular prism (box).
 * Material index is looked up from the materials array by filament ID.
 */
export function generateLayeredMesh(input: LayeredMeshInput): MeshData {
  const {
    layers,
    materials,
    blockCols,
    blockRows,
    panelWidthMm,
    panelHeightMm,
    layerHeightMm,
  } = input;

  const materialIndexMap = new Map(materials.map((m, i) => [m.id, i]));
  const blockW = panelWidthMm / blockCols;
  const blockH = panelHeightMm / blockRows;

  const vertices: Vertex[] = [];
  const triangles: Triangle[] = [];

  for (const layer of layers) {
    const z0 = layer.zPosition;
    const z1 = z0 + layerHeightMm;

    for (const block of layer.blocks) {
      const x0 = block.x * blockW;
      const x1 = x0 + blockW;
      const y0 = block.y * blockH;
      const y1 = y0 + blockH;
      const m = materialIndexMap.get(block.filamentId) ?? 0;

      const base = vertices.length;

      vertices.push(
        { x: x0, y: y0, z: z0 }, // 0 bottom-front-left
        { x: x1, y: y0, z: z0 }, // 1 bottom-front-right
        { x: x1, y: y1, z: z0 }, // 2 bottom-back-right
        { x: x0, y: y1, z: z0 }, // 3 bottom-back-left
        { x: x0, y: y0, z: z1 }, // 4 top-front-left
        { x: x1, y: y0, z: z1 }, // 5 top-front-right
        { x: x1, y: y1, z: z1 }, // 6 top-back-right
        { x: x0, y: y1, z: z1 }, // 7 top-back-left
      );

      // Bottom face (z=z0, normal -Z)
      triangles.push(
        { v1: base + 0, v2: base + 2, v3: base + 1, materialIndex: m },
        { v1: base + 0, v2: base + 3, v3: base + 2, materialIndex: m },
      );

      // Top face (z=z1, normal +Z)
      triangles.push(
        { v1: base + 4, v2: base + 5, v3: base + 6, materialIndex: m },
        { v1: base + 4, v2: base + 6, v3: base + 7, materialIndex: m },
      );

      // Front face (y=y0, normal -Y)
      triangles.push(
        { v1: base + 0, v2: base + 1, v3: base + 5, materialIndex: m },
        { v1: base + 0, v2: base + 5, v3: base + 4, materialIndex: m },
      );

      // Back face (y=y1, normal +Y)
      triangles.push(
        { v1: base + 2, v2: base + 3, v3: base + 7, materialIndex: m },
        { v1: base + 2, v2: base + 7, v3: base + 6, materialIndex: m },
      );

      // Right face (x=x1, normal +X)
      triangles.push(
        { v1: base + 1, v2: base + 2, v3: base + 6, materialIndex: m },
        { v1: base + 1, v2: base + 6, v3: base + 5, materialIndex: m },
      );

      // Left face (x=x0, normal -X)
      triangles.push(
        { v1: base + 3, v2: base + 0, v3: base + 4, materialIndex: m },
        { v1: base + 3, v2: base + 4, v3: base + 7, materialIndex: m },
      );
    }
  }

  return { vertices, triangles };
}
