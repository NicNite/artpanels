import type { Lab } from "@/lib/color/cielab";
import type {
  DitherInput,
  LayerColorMap,
  LayerBlock,
  PixelDitherInfo,
} from "./types";
import { computeZDither } from "./z-dither";
import { computeXYDither } from "./xy-dither";

const COLOR_ERROR_THRESHOLD = 5;

/**
 * Compute a hybrid Z-axis + XY block dithered layer color map.
 *
 * Pipeline:
 * 1. Determine the max layer count (thickest pixel / layerHeight)
 * 2. For each pixel with colorError >= 5: try Z-axis dithering
 * 3. For remaining high-error pixels (thin regions, or Z wasn't enough):
 *    apply XY block dithering per layer
 * 4. Assemble the LayerColorMap
 */
export function computeHybridDither(input: DitherInput): LayerColorMap {
  const { pixels, gridWidth, gridHeight, filaments, settings, panelWidthMm, panelHeightMm } = input;
  const { blockSizeMm, zEnabled, xyEnabled, layerHeightMm } = settings;

  const pixelWidthMm = panelWidthMm / gridWidth;
  const pixelHeightMm = panelHeightMm / gridHeight;
  const blockCols = Math.max(1, Math.round(panelWidthMm / blockSizeMm));
  const blockRows = Math.max(1, Math.round(panelHeightMm / blockSizeMm));

  const maxLayers = Math.max(...pixels.map((p) => p.numLayers), 1);

  // Per-pixel Z-dither results
  const zResults: (string[] | null)[] = pixels.map((pixel) => {
    if (!zEnabled) return null;
    if (pixel.colorError < COLOR_ERROR_THRESHOLD) return null;
    if (pixel.numLayers < 3) return null;

    const result = computeZDither({
      targetLab: pixel.targetLab,
      assignedFilament: {
        id: pixel.assignedFilamentId,
        lab: pixel.assignedLab,
      },
      availableFilaments: filaments.map((f) => ({ id: f.id, lab: f.lab })),
      numLayers: pixel.numLayers,
    });

    return result?.layerFilamentIds ?? null;
  });

  const layers: LayerColorMap = [];

  for (let layerIdx = 0; layerIdx < maxLayers; layerIdx++) {
    const zPosition = layerIdx * layerHeightMm;

    const pixelFilaments: string[] = pixels.map((pixel, pixelIdx) => {
      if (layerIdx >= pixel.numLayers) {
        return pixel.assignedFilamentId;
      }

      const zResult = zResults[pixelIdx];
      if (zResult && layerIdx < zResult.length) {
        return zResult[layerIdx];
      }

      return pixel.assignedFilamentId;
    });

    if (xyEnabled) {
      const needsXY = pixels.map((pixel, pixelIdx) => {
        if (pixel.colorError < COLOR_ERROR_THRESHOLD) return false;
        if (layerIdx >= pixel.numLayers) return false;
        if (zResults[pixelIdx] !== null) return false;
        return true;
      });

      if (needsXY.some(Boolean)) {
        const blockInputs: {
          row: number;
          col: number;
          targetLab: Lab;
        }[] = [];

        for (let br = 0; br < blockRows; br++) {
          for (let bc = 0; bc < blockCols; bc++) {
            const blockPixels: PixelDitherInfo[] = [];
            for (const pixel of pixels) {
              const pixelCenterX = (pixel.col + 0.5) * pixelWidthMm;
              const pixelCenterY = (pixel.row + 0.5) * pixelHeightMm;
              const blockLeft = (bc / blockCols) * panelWidthMm;
              const blockRight = ((bc + 1) / blockCols) * panelWidthMm;
              const blockTop = (br / blockRows) * panelHeightMm;
              const blockBottom = ((br + 1) / blockRows) * panelHeightMm;

              if (
                pixelCenterX >= blockLeft &&
                pixelCenterX < blockRight &&
                pixelCenterY >= blockTop &&
                pixelCenterY < blockBottom
              ) {
                blockPixels.push(pixel);
              }
            }

            if (blockPixels.length === 0) continue;

            const avgLab: Lab = {
              L: blockPixels.reduce((s, p) => s + p.targetLab.L, 0) / blockPixels.length,
              a: blockPixels.reduce((s, p) => s + p.targetLab.a, 0) / blockPixels.length,
              b: blockPixels.reduce((s, p) => s + p.targetLab.b, 0) / blockPixels.length,
            };

            blockInputs.push({ row: br, col: bc, targetLab: avgLab });
          }
        }

        if (blockInputs.length > 0) {
          const xyResults = computeXYDither({
            blocks: blockInputs,
            filaments: filaments.map((f) => ({ id: f.id, lab: f.lab })),
            bayerOrder: 2,
          });

          const xyMap = new Map(
            xyResults.map((r) => [`${r.row},${r.col}`, r.filamentId])
          );

          for (let pixelIdx = 0; pixelIdx < pixels.length; pixelIdx++) {
            if (!needsXY[pixelIdx]) continue;
            const pixel = pixels[pixelIdx];
            const pixelCenterX = (pixel.col + 0.5) * pixelWidthMm;
            const pixelCenterY = (pixel.row + 0.5) * pixelHeightMm;
            const bc = Math.min(
              Math.floor((pixelCenterX / panelWidthMm) * blockCols),
              blockCols - 1
            );
            const br = Math.min(
              Math.floor((pixelCenterY / panelHeightMm) * blockRows),
              blockRows - 1
            );
            const key = `${br},${bc}`;
            const xyFilament = xyMap.get(key);
            if (xyFilament) {
              pixelFilaments[pixelIdx] = xyFilament;
            }
          }
        }
      }
    }

    // Convert pixel-level filaments to block-level LayerBlocks
    const blockMap = new Map<string, string[]>();
    for (let pixelIdx = 0; pixelIdx < pixels.length; pixelIdx++) {
      const pixel = pixels[pixelIdx];
      const pixelCenterX = (pixel.col + 0.5) * pixelWidthMm;
      const pixelCenterY = (pixel.row + 0.5) * pixelHeightMm;
      const bc = Math.min(
        Math.floor((pixelCenterX / panelWidthMm) * blockCols),
        blockCols - 1
      );
      const br = Math.min(
        Math.floor((pixelCenterY / panelHeightMm) * blockRows),
        blockRows - 1
      );
      const key = `${br},${bc}`;
      if (!blockMap.has(key)) blockMap.set(key, []);
      blockMap.get(key)!.push(pixelFilaments[pixelIdx]);
    }

    const blocks: LayerBlock[] = [];
    for (const [key, filamentIds] of blockMap) {
      const [br, bc] = key.split(",").map(Number);
      const counts = new Map<string, number>();
      for (const fid of filamentIds) {
        counts.set(fid, (counts.get(fid) ?? 0) + 1);
      }
      let bestId = filamentIds[0];
      let bestCount = 0;
      for (const [fid, count] of counts) {
        if (count > bestCount) {
          bestCount = count;
          bestId = fid;
        }
      }
      blocks.push({ x: bc, y: br, filamentId: bestId });
    }

    layers.push({ layerIndex: layerIdx, zPosition, blocks });
  }

  return layers;
}
