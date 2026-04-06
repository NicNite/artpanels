import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { build3mf } from "@/lib/export/threemf";
import type { MeshData } from "@/lib/export/mesh";

const simpleMesh: MeshData = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
  triangles: [
    { v1: 0, v2: 1, v3: 2, materialIndex: 0 },
    { v1: 0, v2: 2, v3: 3, materialIndex: 1 },
  ],
};

const materials = [
  { name: "Red", hexColor: "#FF0000" },
  { name: "Blue", hexColor: "#0000FF" },
];

describe("build3mf", () => {
  it("returns a non-empty Buffer", async () => {
    const result = await build3mf(simpleMesh, materials);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces a valid ZIP containing required files", async () => {
    const result = await build3mf(simpleMesh, materials);
    const zip = await JSZip.loadAsync(result);
    const fileNames = Object.keys(zip.files);

    expect(fileNames).toContain("[Content_Types].xml");
    expect(fileNames).toContain("_rels/.rels");
    expect(fileNames).toContain("3D/3dmodel.model");
  });

  it("model XML contains vertices, triangles, and basematerials", async () => {
    const result = await build3mf(simpleMesh, materials);
    const zip = await JSZip.loadAsync(result);
    const modelXml = await zip.file("3D/3dmodel.model")!.async("string");

    expect(modelXml).toContain("<vertices>");
    expect(modelXml).toContain("<triangles>");
    expect(modelXml).toContain("<basematerials");
  });

  it("model XML includes all vertices from the mesh", async () => {
    const result = await build3mf(simpleMesh, materials);
    const zip = await JSZip.loadAsync(result);
    const modelXml = await zip.file("3D/3dmodel.model")!.async("string");

    for (const v of simpleMesh.vertices) {
      expect(modelXml).toContain(`x="${v.x}" y="${v.y}" z="${v.z}"`);
    }
  });

  it("model XML includes material names and colors", async () => {
    const result = await build3mf(simpleMesh, materials);
    const zip = await JSZip.loadAsync(result);
    const modelXml = await zip.file("3D/3dmodel.model")!.async("string");

    for (const m of materials) {
      expect(modelXml).toContain(`name="${m.name}"`);
      expect(modelXml).toContain(`displaycolor="${m.hexColor}"`);
    }
  });
});
