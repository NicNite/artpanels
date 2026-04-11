import type { Lab } from "@/lib/color/cielab";

export type DitherSettings = {
  enabled: boolean;
  blockSizeMm: number;      // 1.6–10, default 3
  zEnabled: boolean;         // default true
  xyEnabled: boolean;        // default true
  layerHeightMm: number;    // default 0.2
  nozzleWidthMm: number;    // default 0.4
};

export const DEFAULT_DITHER_SETTINGS: DitherSettings = {
  enabled: false,
  blockSizeMm: 3,
  zEnabled: true,
  xyEnabled: true,
  layerHeightMm: 0.2,
  nozzleWidthMm: 0.4,
};

export type LayerBlock = {
  x: number;         // block column index
  y: number;         // block row index
  filamentId: string;
};

export type Layer = {
  layerIndex: number;
  zPosition: number;   // mm from bed
  blocks: LayerBlock[];
};

export type LayerColorMap = Layer[];

export type CostEstimate = {
  filamentSwaps: number;
  purgeWasteGrams: number;
  timeOverheadMinutes: number;
};

/** Per-pixel dithering info produced by the analysis phase. */
export type PixelDitherInfo = {
  row: number;
  col: number;
  targetLab: Lab;
  assignedFilamentId: string;
  assignedLab: Lab;
  colorError: number;       // deltaE between target and assigned
  thickness: number;        // mm, from height map
  numLayers: number;        // round(thickness / layerHeight)
};

/** Input to the hybrid dithering pipeline. */
export type DitherInput = {
  /** Per-pixel analysis (row-major order, gridWidth × gridHeight). */
  pixels: PixelDitherInfo[];
  gridWidth: number;
  gridHeight: number;
  /** Available filaments with their LAB colors. */
  filaments: { id: string; lab: Lab; hexColor: string }[];
  settings: DitherSettings;
  panelWidthMm: number;
  panelHeightMm: number;
};
