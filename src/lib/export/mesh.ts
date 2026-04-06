export type Vertex = { x: number; y: number; z: number };
export type Triangle = { v1: number; v2: number; v3: number; materialIndex: number };
export type MeshData = { vertices: Vertex[]; triangles: Triangle[] };

type MeshInput = {
  pixels: { brightness: number; materialIndex: number }[];
  gridWidth: number;
  gridHeight: number;
  panelWidthMm: number;
  panelHeightMm: number;
  thicknessMinMm: number;
  thicknessMaxMm: number;
};

/**
 * Generates a 3D triangle mesh from a pixel grid (lithophane-style).
 *
 * Each pixel becomes a rectangular column (box) with:
 *   - base dimensions: (panelWidthMm / gridWidth) x (panelHeightMm / gridHeight)
 *   - height: thicknessMaxMm - brightness * (thicknessMaxMm - thicknessMinMm)
 *     (dark pixels = thick, bright pixels = thin — lithophane convention)
 *
 * Each box contributes 8 vertices and 12 triangles (6 faces x 2 triangles each).
 * Triangle vertex indices are local to the entire mesh (offset per column).
 */
export function generateMesh(input: MeshInput): MeshData {
  const {
    pixels,
    gridWidth,
    gridHeight,
    panelWidthMm,
    panelHeightMm,
    thicknessMinMm,
    thicknessMaxMm,
  } = input;

  const colW = panelWidthMm / gridWidth;
  const colH = panelHeightMm / gridHeight;

  const vertices: Vertex[] = [];
  const triangles: Triangle[] = [];

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const pixelIndex = row * gridWidth + col;
      const pixel = pixels[pixelIndex];

      const thickness =
        thicknessMaxMm - pixel.brightness * (thicknessMaxMm - thicknessMinMm);

      const x0 = col * colW;
      const x1 = x0 + colW;
      const y0 = row * colH;
      const y1 = y0 + colH;
      const z0 = 0;
      const z1 = thickness;

      // 8 vertices for the box, bottom face first then top face
      //   bottom: 0=x0y0z0, 1=x1y0z0, 2=x1y1z0, 3=x0y1z0
      //   top:    4=x0y0z1, 5=x1y0z1, 6=x1y1z1, 7=x0y1z1
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

      const m = pixel.materialIndex;

      // Bottom face (z=0, normal -Z)
      triangles.push(
        { v1: base + 0, v2: base + 2, v3: base + 1, materialIndex: m },
        { v1: base + 0, v2: base + 3, v3: base + 2, materialIndex: m },
      );

      // Top face (z=thickness, normal +Z)
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
