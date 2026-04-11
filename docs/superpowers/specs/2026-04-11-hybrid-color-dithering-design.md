# Hybrid Color Dithering for 3D-Printed Translucent Panels

**Date**: 2026-04-11
**Status**: Approved
**Author**: Nicho + Claude

## Problem

ArtPanels currently maps each quantized color region to a single filament. When the available filaments don't closely match the source colors (high ΔE), the printed result diverges visibly from the original design. The only options today are: accept the mismatch, or buy more filaments.

Color dithering solves this by spatially mixing two or more filament colors to approximate intermediate colors the printer can't produce with a single filament — the same principle newspapers use to print photos with just CMYK dots.

## Printer Context: Creality K2 Plus with CFS

- **Color system**: Filament swapping via CFS (Creality Filament System), NOT color-mixing hotend
- **Slots**: 4 spools (expandable to 16 with additional CFS units)
- **Nozzle**: 0.4mm (line width ~0.45mm)
- **Layer height**: 0.2mm typical
- **Color change cost**: Each within-layer filament swap requires ~2 seconds + purge material
- **Key constraint**: Minimizing within-layer color changes is critical for print time and waste

## Design: Hybrid Z-axis + XY Block Dithering

### Strategy

Two complementary dithering axes, applied in priority order:

1. **Z-axis dithering (primary)** — Alternate filament colors between layers. A 2mm thick region at 0.2mm layer height = 10 layers. Assign 7 layers to blue and 3 to green → perceived 70/30 blue-green mix when backlit. This is nearly free: each layer is a single filament, so zero extra swaps within the layer.

2. **XY block dithering (secondary)** — Divide each layer into a coarse grid of blocks (default 3mm). Assign each block a filament color using Bayer matrix ordered dithering. This adds within-layer filament swaps but is only used where Z-axis dithering alone can't achieve the target color.

### Why Hybrid

| Approach | Cost per mix | Color resolution | When to use |
|----------|-------------|-----------------|-------------|
| Z-axis only | Zero extra swaps | Limited by layer count (10% steps in thick regions, 50% in thin) | Thick regions (≥3 layers) |
| XY block only | Multiple swaps per layer | High (block-level control) | Any thickness |
| Hybrid | Minimal extra swaps | Best of both | Default — Z first, XY to fill gaps |

### Algorithm Detail

#### Input
- Quantized image with N color clusters (from K-means)
- Filament assignments per cluster (from color mapping)
- Original image pixel data
- Panel thickness map (from brightness → lithophane height map)
- Dither settings (block size, layer height, enabled axes)

#### Step 1: Compute Color Error Map

For each pixel, compute:
- `targetColor`: the original image color at that pixel
- `assignedColor`: the mapped filament color for that pixel's cluster
- `colorError`: ΔE between target and assigned (CIEDE2000 if available, RGB Euclidean for speed)

Pixels where `colorError < 5` are skipped — the flat mapping is close enough.

#### Step 2: Z-axis Dithering

For each pixel position with `colorError ≥ 5`:

1. Compute the panel thickness at that position from the height map
2. Calculate available layers: `numLayers = round(thickness / layerHeight)`
3. If `numLayers < 3`, skip to XY dithering (insufficient Z resolution)
4. Find the two filament colors that bracket the target color (the assigned filament + the nearest alternative filament that, mixed, gets closer to the target)
5. Compute optimal mix ratio: minimize ΔE between `ratio * colorA + (1-ratio) * colorB` and `targetColor`
6. Quantize ratio to available layer count: `layersA = round(ratio * numLayers)`
7. Distribute layers using an interleaved pattern (not grouped): for a 7:3 split across 10 layers → `ABABAABABA` pattern, ensuring even perceptual blending when backlit

Layer assignment pattern uses Bayer-ordered indices to distribute the minority color as evenly as possible through the stack.

#### Step 3: XY Block Dithering

For pixels where Z-axis dithering is insufficient (thin regions or remaining `colorError ≥ 5`):

1. Divide the layer into blocks of `blockSize × blockSize` mm
2. For each block, compute the target color (average of original pixel colors in that block)
3. Apply Bayer matrix ordered dithering at the block level:
   - Compare block's target color against available filament palette
   - Use Bayer threshold to decide which of two candidate filaments this block gets
   - The threshold varies per block position in the Bayer grid, creating the spatial pattern

**Bayer matrix** is chosen over Floyd-Steinberg because:
- Produces regular, repeatable patterns (printer-friendly)
- No error propagation that could create isolated single-line color changes
- Deterministic — same input always produces same output
- The regular pattern is less visible on a backlit translucent panel than on an opaque surface

#### Step 4: Layer Map Generation

Output: a `LayerColorMap` — for each layer index, a 2D grid of filament assignments:

```typescript
type LayerBlock = {
  x: number;      // block column
  y: number;      // block row
  filamentId: string;
};

type Layer = {
  layerIndex: number;
  zPosition: number;  // mm from bed
  blocks: LayerBlock[];
};

type LayerColorMap = Layer[];
```

This is the input to the 3MF mesh generator.

#### Step 5: Swap Cost Estimation

Before committing, estimate:
- Total filament changes across all layers
- Estimated purge waste (grams)
- Estimated time overhead vs. flat (non-dithered) export

Display this to the user on the export page.

### Block Size Constraints

- **Minimum**: `nozzleWidth × 4 = 1.6mm` (for 0.4mm nozzle) — smaller blocks can't be reliably printed as distinct color regions
- **Default**: `3mm` — optimized for 1-2m viewing distance
- **Maximum**: `10mm` — at this size, individual blocks become visible even at distance
- **Configurable per project** via dither settings

### Viewing Distance Guidelines (shown in UI)

| Distance | Recommended block size |
|----------|----------------------|
| < 30cm | 1.5-2mm |
| 1-2m | 3-4mm |
| 3m+ | 5-6mm |

## Data Model

No schema migration needed. Dither settings are stored in the existing `settings Json` field on the Export model:

```typescript
type ExportSettings = {
  resolution: number;         // existing: mesh resolution px
  ditherEnabled: boolean;     // new: default false
  ditherBlockSize: number;    // new: mm, default 3
  ditherZEnabled: boolean;    // new: default true
  ditherXYEnabled: boolean;   // new: default true
  layerHeight: number;        // new: mm, default 0.2
  nozzleWidth: number;        // new: mm, default 0.4
};
```

## UI Changes

### Color Mapping Page

Add a third preview panel:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Original   │  │ Flat Mapped │  │  Dithered   │
│             │  │             │  │  (new)      │
│  (source    │  │  (current   │  │  (simulated │
│   image)    │  │   filament  │  │   dither    │
│             │  │   colors)   │  │   pattern)  │
└─────────────┘  └─────────────┘  └─────────────┘
```

The dithered preview:
- Canvas-based rendering showing the block grid pattern
- Each block rendered in its assigned filament color
- Updates live when filament assignments change
- Shows overall ΔE improvement: "Flat: avg ΔE 15.2 → Dithered: avg ΔE 4.8"

Below the previews, a "Dither Settings" section:
- Block size slider (1.6mm – 10mm, default 3mm)
- Z-axis dithering toggle (default on)
- XY block dithering toggle (default on)
- Layer height input (default 0.2mm)
- Nozzle width input (default 0.4mm)

### Export Page

- "Enable Dithering" checkbox (default off for backward compatibility)
- When enabled, shows dither settings summary and cost estimate:
  - Estimated filament swaps: N
  - Estimated purge waste: Xg
  - Estimated time overhead: +Y min
- "Generate 3MF" produces the dithered multi-layer output

## 3MF Output Changes

### Current (flat)
- One mesh per filament color
- Single-layer geometry (height map determines thickness)

### Dithered
- Multiple meshes per layer per filament color
- Each layer's geometry is subdivided into blocks
- Each block is a rectangular prism at the correct layer height
- Material assignments follow the layer color map
- The top surface of the final layer preserves the height map curvature for the translucent lithophane effect

### Compatibility
- 3MF multi-material spec is supported by: Creality Print, PrusaSlicer, Cura, BambuStudio
- Per-layer material assignment is standard in the 3MF spec via `<triangle>` material references
- The slicer handles actual toolpath generation and purge tower placement

## New Source Files

```
src/lib/dither/
├── bayer.ts          — Bayer matrix generation (2×2, 4×4, 8×8)
├── z-dither.ts       — Z-axis layer interleaving algorithm
├── xy-dither.ts      — XY block dithering with Bayer thresholding
├── hybrid.ts         — Orchestrator: Z-first, then XY for remaining error
├── cost-estimate.ts  — Swap count, purge waste, time overhead calculator
└── types.ts          — LayerColorMap, DitherSettings, CostEstimate types
```

Modifications to existing files:
- `src/lib/export/mesh.ts` — Accept LayerColorMap, generate per-layer block geometry
- `src/lib/export/threemf.ts` — Handle multi-layer material assignments
- `src/components/color-mapper.tsx` — Add third preview panel + dither settings
- `src/app/projects/[id]/candidates/[cid]/export/page.tsx` — Add dither toggle + cost display

## Testing Strategy

- Unit tests for Bayer matrix generation (known outputs for standard sizes)
- Unit tests for Z-dither layer distribution (ratio quantization, interleave patterns)
- Unit tests for XY-dither block assignment (Bayer threshold comparisons)
- Unit tests for hybrid orchestrator (Z-only, XY-only, and combined scenarios)
- Unit tests for cost estimator (known swap counts for test patterns)
- Integration test: full pipeline from image → dither → 3MF, verify valid archive
- Visual test: canvas preview renders expected block pattern for known input

## Deferred (Roadmap)

- **Option B: Textured relief dithering** — dither pattern influences 3D geometry, not just color. Blocks of one color are physically raised. More artistic but harder to slice. Revisit after Option A is proven.
- **Slicer-aware optimization** — analyze the generated 3MF to minimize toolpath travel during color changes, beyond what the slicer does automatically.
- **Perceptual model for backlit panels** — current dithering treats colors as opaque. A translucent-aware model would account for light transmission through stacked colored layers (subtractive color mixing through translucent PLA).
