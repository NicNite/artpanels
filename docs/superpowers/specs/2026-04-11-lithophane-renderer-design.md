# Lithophane 3D Renderer Design

**Date**: 2026-04-11
**Status**: Approved
**Author**: Nicho + Claude

## Problem

The 3D preview page currently renders a plain brown box (`meshPhysicalMaterial` with uniform color). The `imageUrl` prop is received but unused. There is no displacement geometry, no color mapping, and no translucency simulation. Users cannot evaluate what their panel will look like before printing.

## Goal

A physically accurate real-time lithophane renderer that shows:
- **Translucency** — light transmission through variable-thickness PLA via Beer's Law
- **Color** — filament colors from flat mapping and dithered block patterns
- **Geometry** — displaced relief surface from the brightness heightmap
- **Realistic lighting** — rotatable HDRI environment sphere as the sole light source

## Hardware Context

- RTX 3090 (user's GPU) — custom shaders and high-poly geometry are trivially fast
- Browser target: Chrome/Edge with WebGL2

## Rendering Approach: Custom Shader (Option B)

Custom `ShaderMaterial` extending PBR concepts. The HDRI environment provides all lighting — no fake directional lights.

### Light Transport: Three-Term Model

All lighting sampled from the HDRI environment map:

**Term 1 — Transmission (backlight through panel):**
```glsl
vec3 envBack = textureCube(envMap, -normal).rgb;
float transmittance = exp(-absorptionCoeff * thickness);
vec3 transmitted = envBack * transmittance * filamentColor;
```
Whatever HDRI light is behind the panel passes through, attenuated by Beer's Law and tinted by filament color. Thin areas (bright pixels) transmit more; thick areas (dark pixels) block more.

**Term 2 — Diffuse front (room light on relief surface):**
```glsl
vec3 envDiffuse = textureCube(irradianceMap, normal).rgb;
vec3 diffuse = envDiffuse * filamentColor * (1.0 - transmittance) * diffuseStrength;
```
HDRI irradiance (blurred env map) sampled from the displaced surface normal direction. The relief geometry's ridges and valleys catch light differently, making the panel visible from the front in room light. Weighted by `(1 - transmittance)` so opaque areas reflect more while translucent areas let backlight dominate.

**Term 3 — Ambient (fill):**
```glsl
vec3 ambient = envDiffuse * filamentColor * ambientStrength;
```
Low-frequency environment fill prevents shadowed areas from going pure black.

**Final composite:**
```glsl
gl_FragColor = vec4(transmitted + diffuse + ambient, 1.0);
```

### Vertex Shader

Samples the heightmap texture and displaces Z:
```glsl
float height = texture2D(heightMap, uv).r;
float thickness = thicknessMax - height * (thicknessMax - thicknessMin);
vec3 displaced = position + normal * thickness;
```

### Surface Normals

Pre-computed normal map from heightmap via Sobel filter (CPU). Uploaded as a texture. Fragment shader reads per-pixel normals for smooth diffuse shading even on coarse geometry.

### Shader Uniforms

| Uniform | Type | Range | Default | Purpose |
|---------|------|-------|---------|---------|
| `heightMap` | sampler2D | — | — | Brightness → thickness |
| `normalMap` | sampler2D | — | — | Pre-computed surface normals |
| `colorMapFlat` | sampler2D | — | — | Flat filament color texture |
| `colorMapDither` | sampler2D | — | — | Dithered block color texture |
| `absorptionCoeff` | float | 1.0–6.0 | 3.0 | PLA opacity (Beer's Law alpha) |
| `diffuseStrength` | float | 0.0–1.0 | 0.3 | Front surface visibility |
| `ambientStrength` | float | 0.0–0.5 | 0.05 | Shadow fill |
| `colorMode` | int | 0 or 1 | 0 | 0 = flat, 1 = dithered |
| `thicknessMin` | float | mm | 0.4 | From project settings |
| `thicknessMax` | float | mm | 2.0 | From project settings |
| `envRotation` | float | 0–2π | 0 | HDRI azimuth rotation |

## HDRI Environment

### Approach

The HDRI sphere is the **sole light source**. No fake directional or point lights. The user rotates the environment to simulate different lighting conditions:
- Bright spot behind panel = window/backlight simulation
- Bright spot to side = shelf/room lighting
- Bright spot in front = viewing against the light

drei's `<Environment>` component handles loading and rendering. Supports built-in presets and custom `.hdr` files from URLs.

### HDRI Catalog (24 environments, all CC0 from Poly Haven)

**Phase 1 — Built-in drei presets (6, zero config):**

| Preset | Asset | Category |
|--------|-------|----------|
| `dawn` | kiara_1_dawn | Morning |
| `sunset` | venice_sunset | Golden hour |
| `night` | dikhololo_night | Night |
| `apartment` | lebombo | Indoor |
| `studio` | studio_small_03 | Neutral |
| `warehouse` | empty_warehouse_01 | Industrial |

**Phase 2 — Custom Poly Haven HDRIs (18, downloaded to `public/hdris/`):**

All at 1K resolution (~500KB each, ~9MB total). Download URL pattern:
`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/{name}_1k.hdr`

Morning/Sunrise:
- `kiara_2_sunrise` — warm sunrise
- `pink_sunrise` — vivid pink sky
- `golf_course_sunrise` — suburban morning

Bright Midday:
- `kloofendal_48d_partly_cloudy` — high contrast sun
- `autumn_field` — full unobstructed sun
- `blue_lagoon` — cool coastal light
- `alps_field` — mountain daylight

Overcast/Cloudy:
- `kloofendal_overcast` — full overcast, even diffuse
- `fouriesburg_mountain_cloudy` — soft diffuse
- `kloetzle_blei` — European overcast

Golden Hour/Sunset:
- `industrial_sunset` — low angle industrial
- `dikhololo_sunset` — rich orange savanna
- `farm_sunset` — rural evening

Blue Hour/Dusk:
- `kiara_9_dusk` — deep blue dusk
- `qwantani_dusk_1` — purple dusk over water

Indoor Rooms:
- `blinds` — **star pick**: sunlight through window blinds (exact use case)
- `anniversary_lounge` — living room, mixed light

Studio/Neutral:
- `photo_studio_loft_hall` — broad even studio
- `studio_small_08` — soft low-contrast

## Texture Generation Pipeline (CPU, client-side)

All textures generated in the browser from the source image + color mappings. No server round-trip.

### Functions (in `src/lib/renderer/textures.ts`)

**`generateHeightmap(imageData, width, height) → Float32Array`**
- Input: raw RGBA pixel data from Canvas API
- Per pixel: `brightness = (0.299*R + 0.587*G + 0.114*B) / 255`
- Output: single-channel float texture, 0.0 (dark/thick) to 1.0 (bright/thin)

**`generateNormalMap(heightmap, width, height) → Float32Array`**
- Sobel filter on heightmap to compute per-pixel surface gradients
- Output: RGB float texture where R=dX, G=dY, B=up (tangent-space normals)

**`generateColorTexture(imageData, mappings, width, height) → Uint8Array`**
- For each pixel: find nearest source color centroid → map to assigned filament hex
- Output: RGBA texture with filament colors (same logic as the 2D mapped preview)

**`generateDitherTexture(imageData, mappings, blockSizeMm, panelWidthMm, width, height) → Uint8Array`**
- Divide into blocks, apply Bayer-threshold two-closest-filament dithering per block
- Output: RGBA texture with dithered block pattern (same logic as the 2D dither preview)

## Geometry

- `PlaneGeometry(panelWidth, panelHeight, resolutionX, resolutionY)`
- Resolution matches export resolution setting (e.g., 128×128 segments)
- Vertex shader displaces Z using the heightmap — same formula as `mesh.ts`
- Geometry is WYSIWYG: what you see in the preview matches the export mesh resolution

## Component Architecture

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/renderer/textures.ts` | Pure functions: heightmap, normalmap, color/dither textures from image + mappings |
| `src/lib/renderer/lithophane-shader.ts` | GLSL vertex + fragment shader strings, uniform types, `createUniforms()` factory |
| `src/components/lithophane-renderer.tsx` | Core R3F component: Canvas, displaced mesh, ShaderMaterial, HDRI Environment, OrbitControls |
| `src/components/lithophane-renderer-loader.tsx` | `dynamic()` SSR-safe wrapper (same pattern as existing `panel-viewer-loader.tsx`) |
| `src/components/renderer-controls.tsx` | UI overlay: HDRI preset picker, environment rotation slider, absorption slider, color mode toggle |
| `__tests__/lib/renderer/textures.test.ts` | Tests for texture generation functions |

### Deleted Files

| File | Reason |
|------|--------|
| `src/components/panel-viewer.tsx` | Replaced entirely by `lithophane-renderer.tsx` |
| `src/components/panel-viewer-loader.tsx` | Replaced by `lithophane-renderer-loader.tsx` |

### Modified Files

| File | Change |
|------|--------|
| `src/app/projects/[id]/candidates/[cid]/preview/page.tsx` | Replace `PanelViewerLoader` import with `LithophaneRendererLoader`, pass color mappings + dither settings |
| `src/components/color-mapper.tsx` | Add toggleable inline `LithophaneRendererLoader` below the 2D previews |

### Props

```typescript
interface LithophaneRendererProps {
  imageUrl: string;
  mappings: Mapping[];           // from color mapping
  panelWidthMm: number;
  panelHeightMm: number;
  thicknessMinMm: number;
  thicknessMaxMm: number;
  resolution: number;            // grid segments (matches export resolution)
  ditherBlockSizeMm?: number;    // for dither texture generation
  compact?: boolean;             // true = inline mode, false = full page
}
```

### Compact vs Full Mode

| Aspect | compact=true (color mapper) | compact=false (preview page) |
|--------|---------------------------|------------------------------|
| Aspect ratio | 1:1, matches other previews | 4:3, full page width |
| Controls | Minimal overlay (HDRI preset, rotation, color mode) | Full sidebar with all sliders |
| Resolution | Uses preview canvas size setting | Uses export resolution setting |
| HDRI options | 6 drei built-in presets | All 24 presets with thumbnails |
| Visibility | Toggled via checkbox | Always visible |
| Canvas height | ~300px | ~500px |

## User Controls

### Preview Page (full mode)

- **HDRI Preset Picker** — dropdown or thumbnail grid, all 24 environments
- **Environment Rotation** — horizontal drag on viewport or azimuth slider (0°–360°)
- **Absorption Coefficient** — slider 1.0–6.0, default 3.0 ("Material opacity")
- **Diffuse Strength** — slider 0.0–1.0, default 0.3 ("Front surface")
- **Color Mode** — toggle: Flat / Dithered
- **Orbit Controls** — left drag = rotate panel, scroll = zoom, right drag = pan

### Color Mapper (compact mode)

- **3D Preview checkbox** — toggles the entire renderer on/off
- **HDRI Preset** — dropdown, 6 built-in presets
- **Environment Rotation** — slider
- **Color Mode** — Flat / Dithered toggle

## Testing Strategy

- Unit tests for `generateHeightmap`: known pixel data → expected brightness values
- Unit tests for `generateNormalMap`: flat heightmap → all normals point up; gradient heightmap → normals tilt
- Unit tests for `generateColorTexture`: pixel → nearest centroid → filament color mapping
- Unit tests for `generateDitherTexture`: block boundaries, Bayer threshold application
- Visual test: renderer loads without console errors, displays non-black canvas
- Integration: changing HDRI preset, rotating environment, toggling color mode all respond without error

## Deferred (Roadmap)

- **Option C: Raymarched volume rendering** — true volumetric light transport through voxel layers. Beer's Law absorption per Z-layer. Most physically accurate for stacked colored PLA. Revisit after Option B shader renderer is proven.
- **PLA material library** — per-filament absorption coefficients calibrated from real measurements (currently uses a single global coefficient).
- **Subsurface scattering** — light scatters sideways through PLA, not just straight through. Would soften the transmitted image slightly, more realistic but requires more complex shader.
