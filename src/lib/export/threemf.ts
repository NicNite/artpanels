import archiver from "archiver";
import { Writable } from "stream";
import type { MeshData } from "./mesh";

type Material = { name: string; hexColor: string };

export async function build3mf(
  mesh: MeshData,
  materials: Material[],
): Promise<Buffer> {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

  const baseMaterials = materials
    .map((m) => `      <base name="${m.name}" displaycolor="${m.hexColor}" />`)
    .join("\n");

  const verticesXml = mesh.vertices
    .map((v) => `          <vertex x="${v.x}" y="${v.y}" z="${v.z}" />`)
    .join("\n");

  const trianglesXml = mesh.triangles
    .map(
      (t) =>
        `          <triangle v1="${t.v1}" v2="${t.v2}" v3="${t.v3}" pid="1" p1="${t.materialIndex}" />`,
    )
    .join("\n");

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
${baseMaterials}
    </basematerials>
    <object id="2" type="model">
      <mesh>
        <vertices>
${verticesXml}
        </vertices>
        <triangles>
${trianglesXml}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="2" />
  </build>
</model>`;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const writable = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    });

    writable.on("finish", () => resolve(Buffer.concat(chunks)));
    writable.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.pipe(writable);

    archive.append(contentTypes, { name: "[Content_Types].xml" });
    archive.append(rels, { name: "_rels/.rels" });
    archive.append(model, { name: "3D/3dmodel.model" });

    archive.finalize();
  });
}
