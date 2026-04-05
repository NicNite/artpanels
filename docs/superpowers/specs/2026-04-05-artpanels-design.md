# ArtPanels — Design Specification

Personal tool for designing multi-color translucent 3D-printed art panels for glass windows and doors. Generates designs via AI image generation, maps colors to available filaments, and exports multi-material 3MF files for slicing and printing.

## Architecture

**Approach:** Next.js full-stack monolith calling an external FLUX FastAPI server for image generation.

```
Browser (React)
  ├── Projects List / Dashboard
  ├── Design Explorer (prompt + gallery)
  ├── Color Mapper (quantize + filament match)
  ├── 3D Preview (Three.js)
  └── Export (3MF download)
       │
       │ HTTP / SSE
       ▼
Next.js App Router (API Routes)
  ├── Project CRUD
  ├── Generate API → Provider Interface → LocalFluxProvider → FLUX FastAPI
  ├── Color API (K-means, Delta-E matching)
  └── Export API (3MF generation)
       │
       │ Prisma
       ▼
PostgreSQL + local filesystem (images, 3MF files)
```

The FLUX FastAPI server is the existing avatar generation server from the choirapp project, adapted for art panel generation. It runs FLUX.1 Schnell (Q8_0 GGUF, ~13GB VRAM) on a local RTX 4090.

## Workflow

Six-phase pipeline, non-linear (user can jump back to any phase):

1. **Create Project** — Name, description, theme, panel dimensions (from template or custom mm), min/max thickness.
2. **Explore Designs** — Enter prompts, generate batches of images (configurable count), star favorites, tweak prompts, generate more. Full prompt + parameter history preserved per generation.
3. **Select Candidate** — Pick one starred image as the basis for the physical panel.
4. **Color Mapping** — Quantize the selected image to N colors (matching CMS slot count: 4/8/configurable). K-means clustering in CIELAB space. Auto-match each color to the nearest filament using Delta-E (CIEDE2000). Manual override per color. Preview the image re-rendered in filament colors.
5. **3D Preview** — Interactive Three.js viewer showing the panel as a 3D mesh. Adjustable min/max thickness sliders. Backlighting simulation to preview translucency. Rotate, zoom, pan.
6. **Export 3MF** — Generate a multi-material 3MF file with mesh geometry and filament/material assignments. Download for import into Creality Print, OrcaSlicer, or Cura.

## Data Model

### Project
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | text | |
| description | text | |
| theme | text | |
| width_mm | int | Panel physical width |
| height_mm | int | Panel physical height |
| thickness_min_mm | float | Thinnest point, e.g. 0.4mm |
| thickness_max_mm | float | Thickest point, e.g. 2.0mm |
| status | enum | exploring, color_mapping, previewing, exported |
| created_at | timestamp | |
| updated_at | timestamp | |

### Generation
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | FK → Project | |
| prompt | text | |
| negative_prompt | text | |
| provider | text | e.g. "local-flux" |
| model_params | jsonb | steps, guidance, seed, size, etc. |
| created_at | timestamp | |

One generation = one prompt execution producing N images.

### Image
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| generation_id | FK → Generation | |
| file_path | text | Local storage path |
| thumbnail_path | text | |
| seed | bigint | For reproducibility |
| starred | boolean | |
| selected | boolean | The chosen candidate |
| notes | text | |
| created_at | timestamp | |

### ColorMapping
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | FK → Project | |
| image_id | FK → Image | The selected candidate |
| algorithm | text | k-means, manual, etc. |
| num_colors | int | Matches CMS slot count |
| mappings | jsonb | Array of {source_rgb, filament_id, target_rgb} |
| preview_path | text | Re-rendered preview image path |
| is_final | boolean | |
| created_at | timestamp | |

### Filament
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| brand | text | e.g. "Polymaker" |
| name | text | e.g. "PolyTerra PLA" |
| color_name | text | e.g. "Cotton White" |
| hex_color | text | #FFFFFF |
| material | text | PLA, PETG, TPU, etc. |
| translucent | boolean | |
| owned | boolean | In personal inventory vs. catalog |
| notes | text | |

Shared across all projects. Supports both personal inventory and manufacturer catalog entries.

### Export
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | FK → Project | |
| color_mapping_id | FK → ColorMapping | |
| file_path | text | .3mf file path |
| format | text | 3mf, stl |
| settings | jsonb | resolution, smoothing, etc. |
| created_at | timestamp | |

### Relationships
```
Project  1 → N  Generation  1 → N  Image
Project  1 → N  ColorMapping (one per attempt)
Project  1 → N  Export
ColorMapping → 1 Image (the selected candidate)
ColorMapping.mappings[] → Filament (by filament_id)
Filament is independent (shared across projects)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui |
| 3D Preview | Three.js via react-three-fiber |
| Backend | Next.js API Routes (REST) |
| ORM | Prisma |
| Database | PostgreSQL |
| Image Storage | Local filesystem |
| Streaming | Server-Sent Events (SSE) for generation progress |
| Image Generation | FLUX.1 Schnell via existing FastAPI server |
| 3MF Generation | Pure Node.js (XML + ZIP) |
| Color Processing | K-means in CIELAB, Delta-E CIEDE2000 matching |
| Package Manager | pnpm |
| Language | TypeScript end-to-end |
| Local Dev DB | Docker Compose (PostgreSQL) |
| Source Control | GitHub |

## Image Generation Provider Interface

```typescript
interface ImageProvider {
  id: string;
  name: string;
  healthCheck(): Promise<boolean>;
  generate(request: GenerateRequest): AsyncGenerator<GenerateEvent>;
}

type GenerateRequest = {
  prompt: string;
  negativePrompt?: string;
  count: number;
  width: number;
  height: number;
  seed?: number;
  params?: Record<string, unknown>;
}

type GenerateEvent =
  | { type: "progress"; index: number; step: number; totalSteps: number }
  | { type: "image"; index: number; data: Buffer; seed: number }
  | { type: "error"; index: number; message: string }
  | { type: "done" }
```

Initial provider: `LocalFluxProvider` wrapping the existing choirapp FastAPI server. The interface is designed for future cloud providers (DALL-E, Stability AI, etc.) to be added by implementing the same interface.

## Color Quantization Pipeline

1. **K-means clustering** in CIELAB color space (not RGB — perceptually uniform). K = number of CMS slots (configurable: 4, 8, etc.).
2. **Filament matching** — for each cluster centroid, find the closest filament in the user's library using Delta-E (CIEDE2000). Show match quality score. Allow manual override per color.
3. **Preview rendering** — replace each pixel's color with its matched filament color. Display side-by-side comparison (original vs. mapped).

## 3MF Export Pipeline

1. **Parse** the color-mapped image into a pixel grid. Each pixel has: a filament assignment (from ColorMapping) and a brightness value mapped to thickness (thickness_min_mm to thickness_max_mm).
2. **Generate mesh** — each pixel becomes a rectangular column (6 faces, 12 triangles). Base size = panel_width/pixels_x by panel_height/pixels_y. Height = mapped thickness. Columns grouped by material.
3. **Build 3MF package** — ZIP containing:
   - `[Content_Types].xml`
   - `3D/3dmodel.model` (mesh vertices/triangles + `<basematerials>` with filament colors)
   - `_rels/.rels`
4. **Optimization** — adjacent columns with same height and same material can be merged to reduce triangle count.

Output is directly importable by Creality Print, OrcaSlicer, and Cura with multi-material support.

## UI Routes

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — project list with status cards, create new |
| `/projects/:id` | Project overview — settings, status, quick actions |
| `/projects/:id/explore` | Design Explorer — prompt bar, image grid, star/select |
| `/projects/:id/colors` | Color Mapper — quantize, match filaments, preview |
| `/projects/:id/preview` | 3D Preview — Three.js viewer, thickness controls, lighting |
| `/projects/:id/export` | Export — generate 3MF, download, print settings |
| `/filaments` | Filament Library — manage owned inventory + browse catalogs |

Navigation: tab bar at top of each project page (Explore → Colors → 3D → Export). Status guides the natural flow but doesn't restrict movement.

## Panel Dimensions

- **Templates** for common window sizes (e.g., 300x400mm, 500x800mm)
- **Custom** dimensions — enter any width/height in mm
- **Tiling** support (future enhancement) — repeat a pattern across multiple panels for large windows

## Hardware Context

- **3D Printer:** Creality K2 Max with 4-color CMS (upgradeable to 8)
- **GPU:** NVIDIA RTX 4090 (24GB VRAM) for local FLUX inference
- **CMS slots** configurable per project (4, 8, or custom N)
