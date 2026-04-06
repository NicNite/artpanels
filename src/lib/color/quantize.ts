import type { Lab } from './cielab';
import { rgbToLab, labToRgb } from './cielab';
import { deltaE00 } from './delta-e';
import { kmeansLab } from './kmeans';

export type Pixel = { r: number; g: number; b: number };
export type FilamentRef = { id: string; hexColor: string };
export type ColorMappingEntry = {
  sourceRgb: string;   // hex of the centroid
  sourceLab: Lab;
  filamentId: string;
  targetRgb: string;   // hex of the matched filament
  deltaE: number;
};
export type QuantizeResult = {
  mappings: ColorMappingEntry[];
  assignments: number[];
};

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;
  const val = parseInt(full, 16);
  return {
    r: (val >> 16) & 0xff,
    g: (val >> 8) & 0xff,
    b: val & 0xff,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function quantizeAndMatch(
  pixels: Pixel[],
  numColors: number,
  filaments: FilamentRef[]
): QuantizeResult {
  if (pixels.length === 0 || filaments.length === 0) {
    return { mappings: [], assignments: [] };
  }

  // 1. Convert pixels to LAB
  const labPixels: Lab[] = pixels.map(({ r, g, b }) => rgbToLab(r, g, b));

  // 2. K-means cluster into numColors groups
  const k = Math.min(numColors, pixels.length, filaments.length);
  const { centroids, assignments } = kmeansLab(labPixels, k);

  // 3. Convert filaments to LAB for comparison
  const filamentLabs = filaments.map((f) => {
    const { r, g, b } = hexToRgb(f.hexColor);
    return rgbToLab(r, g, b);
  });

  // 4. For each centroid, find closest filament by deltaE00
  const mappings: ColorMappingEntry[] = centroids.map((centroid) => {
    let minDelta = Infinity;
    let bestFilament = filaments[0];

    for (let i = 0; i < filaments.length; i++) {
      const de = deltaE00(centroid, filamentLabs[i]);
      if (de < minDelta) {
        minDelta = de;
        bestFilament = filaments[i];
      }
    }

    return {
      sourceRgb: '',  // will be filled below after loop
      sourceLab: centroid,
      filamentId: bestFilament.id,
      targetRgb: bestFilament.hexColor.startsWith('#')
        ? bestFilament.hexColor
        : '#' + bestFilament.hexColor,
      deltaE: minDelta,
    };
  });

  // Fix sourceRgb: convert centroid LAB back to RGB hex
  for (const mapping of mappings) {
    const { r, g, b } = labToRgb(mapping.sourceLab.L, mapping.sourceLab.a, mapping.sourceLab.b);
    mapping.sourceRgb = rgbToHex(r, g, b);
  }

  return { mappings, assignments };
}
