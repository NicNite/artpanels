import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { readImageFile, saveExportFile } from "@/lib/storage";
import { generateMesh } from "@/lib/export/mesh";
import { build3mf } from "@/lib/export/threemf";
import { rgbToLab } from "@/lib/color/cielab";
import { deltaE00 } from "@/lib/color/delta-e";
import { computeHybridDither } from "@/lib/dither/hybrid";
import { estimateCost } from "@/lib/dither/cost-estimate";
import { generateLayeredMesh } from "@/lib/export/layered-mesh";
import type { DitherSettings, PixelDitherInfo } from "@/lib/dither/types";
import { DEFAULT_DITHER_SETTINGS } from "@/lib/dither/types";

type MappingEntry = {
  sourceRgb: string;
  filamentId: string;
  targetRgb: string;
  deltaE: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

function rgbDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;

  const candidate = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const exports = await db.export.findMany({
    where: { candidateId: cid },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(exports);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;

  // 1. Fetch candidate with image, project, and color mappings
  const candidate = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
    include: {
      image: true,
      project: true,
      colorMappings: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // 2. Pick color mapping: prefer isFinal, fallback to most recent
  const colorMapping =
    candidate.colorMappings.find((cm) => cm.isFinal) ??
    candidate.colorMappings[0] ??
    null;

  if (!colorMapping) {
    return NextResponse.json(
      { error: "No color mapping found for this candidate" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const resolution: number = body.resolution ?? 128;
  const ditherSettings: DitherSettings = {
    ...DEFAULT_DITHER_SETTINGS,
    ...body.dither,
  };

  // 3. Read and resize image
  const imageBuffer = await readImageFile(candidate.image.filePath);
  const resized = await sharp(imageBuffer)
    .resize(resolution, resolution, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: rawPixels, info } = resized;
  const { width: gridWidth, height: gridHeight, channels } = info;

  // 4. Parse mappings and get filament details
  const mappings = colorMapping.mappings as MappingEntry[];
  const filamentIds = [...new Set(mappings.map((m) => m.filamentId))];
  const filaments = await db.filament.findMany({
    where: { id: { in: filamentIds } },
  });
  const filamentMap = new Map(filaments.map((f) => [f.id, f]));

  // Build centroids from mappings (unique sourceRgb -> materialIndex)
  const uniqueSources = Array.from(
    new Map(mappings.map((m) => [m.sourceRgb, m])).values()
  );

  const centroids = uniqueSources.map((m) => ({
    rgb: hexToRgb(m.sourceRgb),
    targetRgb: m.targetRgb,
    filamentId: m.filamentId,
  }));

  // 5. For each pixel: compute brightness, find nearest centroid, assign materialIndex
  const pixels: { brightness: number; materialIndex: number }[] = [];

  for (let i = 0; i < gridWidth * gridHeight; i++) {
    const offset = i * channels;
    const r = rawPixels[offset];
    const g = rawPixels[offset + 1];
    const b = rawPixels[offset + 2];

    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const pixelRgb = { r, g, b };
    let nearestIndex = 0;
    let nearestDist = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const dist = rgbDistance(pixelRgb, centroids[c].rgb);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = c;
      }
    }

    pixels.push({ brightness, materialIndex: nearestIndex });
  }

  // 6-8. Generate mesh and build 3MF buffer (flat or dithered pipeline)
  const { project } = candidate;

  let buffer: Buffer;
  let cost: { filamentSwaps: number; purgeWasteGrams: number; timeOverheadMinutes: number } | undefined;

  if (ditherSettings.enabled) {
    // --- Dithered pipeline ---
    const filamentLabList = filaments.map((f) => {
      const rgb = hexToRgb(f.hexColor);
      const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
      return { id: f.id, lab, hexColor: f.hexColor };
    });

    const ditherPixels: PixelDitherInfo[] = [];
    for (let i = 0; i < gridWidth * gridHeight; i++) {
      const offset = i * channels;
      const r = rawPixels[offset];
      const g = rawPixels[offset + 1];
      const b = rawPixels[offset + 2];
      const row = Math.floor(i / gridWidth);
      const col = i % gridWidth;

      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const thickness =
        project.thicknessMaxMm -
        brightness * (project.thicknessMaxMm - project.thicknessMinMm);
      const numLayers = Math.max(
        1,
        Math.round(thickness / ditherSettings.layerHeightMm)
      );

      const targetLab = rgbToLab(r, g, b);
      const centroidIdx = pixels[i].materialIndex;
      const assignedFilament = filamentLabList.find(
        (f) => f.id === centroids[centroidIdx].filamentId
      ) ?? filamentLabList[0];
      const colorError = deltaE00(targetLab, assignedFilament.lab);

      ditherPixels.push({
        row,
        col,
        targetLab,
        assignedFilamentId: assignedFilament.id,
        assignedLab: assignedFilament.lab,
        colorError,
        thickness,
        numLayers,
      });
    }

    const layerColorMap = computeHybridDither({
      pixels: ditherPixels,
      gridWidth,
      gridHeight,
      filaments: filamentLabList,
      settings: ditherSettings,
      panelWidthMm: project.widthMm,
      panelHeightMm: project.heightMm,
    });

    cost = estimateCost(layerColorMap);

    const layeredMaterials = centroids.map((c) => {
      const filament = filamentMap.get(c.filamentId);
      const name = filament
        ? `${filament.brand} ${filament.colorName}`
        : c.filamentId;
      return { id: c.filamentId, name, hexColor: c.targetRgb };
    });

    const blockCols = Math.max(
      1,
      Math.round(project.widthMm / ditherSettings.blockSizeMm)
    );
    const blockRows = Math.max(
      1,
      Math.round(project.heightMm / ditherSettings.blockSizeMm)
    );

    const mesh = generateLayeredMesh({
      layers: layerColorMap,
      materials: layeredMaterials,
      blockCols,
      blockRows,
      panelWidthMm: project.widthMm,
      panelHeightMm: project.heightMm,
      layerHeightMm: ditherSettings.layerHeightMm,
    });

    const materials3mf = layeredMaterials.map((m) => ({
      name: m.name,
      hexColor: m.hexColor,
    }));

    buffer = await build3mf(mesh, materials3mf);
  } else {
    // --- Flat pipeline (existing) ---
    const mesh = generateMesh({
      pixels,
      gridWidth,
      gridHeight,
      panelWidthMm: project.widthMm,
      panelHeightMm: project.heightMm,
      thicknessMinMm: project.thicknessMinMm,
      thicknessMaxMm: project.thicknessMaxMm,
    });

    const materials = centroids.map((c) => {
      const filament = filamentMap.get(c.filamentId);
      const name = filament
        ? `${filament.brand} ${filament.colorName}`
        : c.filamentId;
      return { name, hexColor: c.targetRgb };
    });

    buffer = await build3mf(mesh, materials);
  }

  // 9. Save export file
  const filePath = await saveExportFile(cid, buffer);

  // 10. Create Export record
  const exportRecord = await db.export.create({
    data: {
      candidateId: cid,
      colorMappingId: colorMapping.id,
      filePath,
      format: "3mf",
      settings: {
        resolution,
        ...(ditherSettings.enabled ? { dither: ditherSettings, cost } : {}),
      },
    },
  });

  // 11. Update candidate status to "exported"
  await db.candidate.update({
    where: { id: cid },
    data: { status: "exported" },
  });

  // 12. Return the export record
  return NextResponse.json(exportRecord, { status: 201 });
}
