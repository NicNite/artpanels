import type { Lab } from "@/lib/color/cielab";
import { deltaE00 } from "@/lib/color/delta-e";

type FilamentColor = { id: string; lab: Lab };

type ZDitherInput = {
  targetLab: Lab;
  assignedFilament: FilamentColor;
  availableFilaments: FilamentColor[];
  numLayers: number;
};

type ZDitherResult = {
  layerFilamentIds: string[];
  filamentA: string;
  filamentB: string;
  ratio: number;
  residualDeltaE: number;
};

/**
 * Distribute `countA` items of type A across `total` slots using
 * Bresenham-style distribution for even spacing. Returns boolean array: true = A, false = B.
 */
export function interleavePattern(total: number, countA: number): boolean[] {
  if (countA >= total) return Array(total).fill(true);
  if (countA <= 0) return Array(total).fill(false);

  const result: boolean[] = Array(total).fill(false);
  const countB = total - countA;

  if (countA >= countB) {
    let error = 0;
    for (let i = 0; i < total; i++) {
      error += countB;
      if (error * 2 >= total) {
        result[i] = false;
        error -= total;
      } else {
        result[i] = true;
      }
    }
  } else {
    let error = 0;
    for (let i = 0; i < total; i++) {
      error += countA;
      if (error * 2 >= total) {
        result[i] = true;
        error -= total;
      } else {
        result[i] = false;
      }
    }
  }

  return result;
}

/** Mix two LAB colors by linear interpolation. */
function mixLab(a: Lab, b: Lab, ratioA: number): Lab {
  const ratioB = 1 - ratioA;
  return {
    L: a.L * ratioA + b.L * ratioB,
    a: a.a * ratioA + b.a * ratioB,
    b: a.b * ratioA + b.b * ratioB,
  };
}

/**
 * Compute Z-axis dithering for a single pixel column.
 *
 * Finds the best second filament to mix with the assigned one, computes
 * the optimal ratio, quantizes to available layers, and returns the
 * interleaved layer assignment.
 *
 * Returns null if:
 * - numLayers < 3 (insufficient Z resolution)
 * - No mix of two filaments improves on the assigned color
 */
export function computeZDither(input: ZDitherInput): ZDitherResult | null {
  const { targetLab, assignedFilament, availableFilaments, numLayers } = input;

  if (numLayers < 3) return null;

  const assignedDeltaE = deltaE00(targetLab, assignedFilament.lab);
  if (assignedDeltaE < 1) return null;

  let bestResult: ZDitherResult | null = null;
  let bestDeltaE = assignedDeltaE;

  for (const candidate of availableFilaments) {
    if (candidate.id === assignedFilament.id) continue;

    for (let layersA = 0; layersA <= numLayers; layersA++) {
      const ratio = layersA / numLayers;
      const mixed = mixLab(assignedFilament.lab, candidate.lab, ratio);
      const de = deltaE00(targetLab, mixed);

      if (de < bestDeltaE) {
        bestDeltaE = de;
        const pattern = interleavePattern(numLayers, layersA);
        bestResult = {
          layerFilamentIds: pattern.map((isA) =>
            isA ? assignedFilament.id : candidate.id
          ),
          filamentA: assignedFilament.id,
          filamentB: candidate.id,
          ratio,
          residualDeltaE: de,
        };
      }
    }
  }

  return bestResult;
}
